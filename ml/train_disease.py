"""
Stage 2: train the disease classifier (Variation / OPMD / Oral Cancer).

Run AFTER the binary stage:
    python ml/dataset_split.py        # produces train_df_disease.csv etc.
    python ml/train.py                 # binary model — already done
    python ml/train_disease.py         # this file

The Oral Cancer class has only ~15 training samples, so this script stacks
several imbalance-fighting techniques:
  - WeightedRandomSampler  → every batch is class-balanced
  - Strong albumentations augmentation → each rare-class image seen with variation
  - Focal Loss (γ=2)       → focuses gradient on hard examples
  - ResNet18 + heavier dropout → less capacity to memorise the few cancer images

Saves to:
  <PROJECT_ROOT>/disease_<MODEL_NAME>/<MODEL_NAME>_best.pth
  <PROJECT_ROOT>/disease_best_model.pth
  <PROJECT_ROOT>/disease_best_model.pkl
"""
import json
import os
import pickle
import sys
import time

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from torch.optim.lr_scheduler import ReduceLROnPlateau
from tqdm import tqdm

from data_loader import PROJECT_ROOT, get_loaders_disease
from model import get_model
from train import plot_training_metrics, set_seed

os.environ.setdefault("CUBLAS_WORKSPACE_CONFIG", ":4096:8")

# --- Configuration --------------------------------------------------------
TRAIN_CSV = os.path.join(PROJECT_ROOT, "data", "train_df_disease.csv")
TEST_CSV = os.path.join(PROJECT_ROOT, "data", "test_df_disease.csv")

# Heavier dropout (0.5) than the binary stage — small dataset, easy to overfit.
MODEL_NAME = "ResNet18_mod1_weighted_dp(0.5)"

NUM_EPOCHS = 100
BATCH_SIZE = 16
INITIAL_LR = 5e-4
WEIGHT_DECAY = 1e-4
EARLY_STOP_PATIENCE = 25
REDUCE_LR_PATIENCE = 8
REDUCE_LR_FACTOR = 0.5
SEED = 3

NUM_CLASSES = 3
CLASS_NAMES = ["Variation", "OPMD", "Oral Cancer"]
TASK_MODE = "disease_3class"

USE_FOCAL_LOSS = True
FOCAL_GAMMA = 2.0


# --- Focal loss -----------------------------------------------------------
class FocalLoss(nn.Module):
    """Multi-class focal loss. (1 - p_t)^γ · CE(p, y).

    γ=0 reduces to plain CE. γ=2 is the standard setting from Lin et al. 2017.
    Optional class weights (`alpha`) can further bias towards rare classes.
    """

    def __init__(self, gamma: float = 2.0, alpha: torch.Tensor = None,
                 reduction: str = "mean"):
        super().__init__()
        self.gamma = gamma
        self.alpha = alpha
        self.reduction = reduction

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        ce = F.cross_entropy(logits, targets, weight=self.alpha, reduction="none")
        pt = torch.exp(-ce)
        loss = ((1.0 - pt) ** self.gamma) * ce
        if self.reduction == "mean":
            return loss.mean()
        if self.reduction == "sum":
            return loss.sum()
        return loss


# --- Per-epoch routines ---------------------------------------------------

def train_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss, correct, total = 0.0, 0, 0
    step_times = []
    t0 = time.time()
    for images, labels in tqdm(loader, desc='Train', leave=False):
        ts = time.time()
        images, labels = images.to(device), labels.to(device).long()
        optimizer.zero_grad()
        outputs = model(images).float()
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * labels.size(0)
        correct += (outputs.argmax(1) == labels).sum().item()
        total += labels.size(0)
        step_times.append(time.time() - ts)
    return total_loss / total, correct / total, time.time() - t0, step_times


def validate_epoch(model, loader, criterion, device):
    model.eval()
    total_loss, correct, total = 0.0, 0, 0
    with torch.no_grad():
        for images, labels in tqdm(loader, desc='Val', leave=False):
            images, labels = images.to(device), labels.to(device).long()
            outputs = model(images).float()
            loss = criterion(outputs, labels)
            total_loss += loss.item() * labels.size(0)
            correct += (outputs.argmax(1) == labels).sum().item()
            total += labels.size(0)
    return total_loss / total, correct / total


def save_pkl_bundle(model, model_name, num_classes, class_names, task_mode, pkl_path):
    bundle = {
        "model": model,
        "model_name": model_name,
        "num_classes": num_classes,
        "class_names": class_names,
        "task_mode": task_mode,
        "architecture": "resnet18" if "ResNet18" in model_name else "resnet50",
    }
    with open(pkl_path, "wb") as f:
        pickle.dump(bundle, f)


# --- Main -----------------------------------------------------------------

def main():
    set_seed(SEED)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    if not (os.path.exists(TRAIN_CSV) and os.path.exists(TEST_CSV)):
        sys.exit(
            "Missing disease CSVs. Run `python ml/dataset_split.py` first."
        )

    train_loader, test_loader, train_df, test_df = get_loaders_disease(
        TRAIN_CSV, TEST_CSV, batch_size=BATCH_SIZE,
    )

    counts = np.bincount(train_df['label'].values, minlength=NUM_CLASSES)
    print(f"Train: {len(train_df)} | Test: {len(test_df)}")
    print("Train distribution (raw, before sampler rebalances batches):")
    for i, c in enumerate(counts):
        print(f"  [{i}] {CLASS_NAMES[i]}: {c}")
    print("→ WeightedRandomSampler will sample each class with equal expected frequency.")
    print("→ Strong augmentation gives each rare-class image many distinct views.")

    model = get_model(name=MODEL_NAME, num_classes=NUM_CLASSES, device=device)
    print(f"Model: {MODEL_NAME}")

    if USE_FOCAL_LOSS:
        criterion = FocalLoss(gamma=FOCAL_GAMMA)
        print(f"Loss : Focal Loss (γ={FOCAL_GAMMA})")
    else:
        criterion = nn.CrossEntropyLoss()
        print("Loss : CrossEntropy")

    optimizer = optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=INITIAL_LR, weight_decay=WEIGHT_DECAY,
    )
    scheduler = ReduceLROnPlateau(
        optimizer, mode='min', factor=REDUCE_LR_FACTOR, patience=REDUCE_LR_PATIENCE,
    )

    out_dir = os.path.join(PROJECT_ROOT, "disease_" + MODEL_NAME)
    os.makedirs(out_dir, exist_ok=True)
    best_pth = os.path.join(out_dir, f"{MODEL_NAME}_best.pth")
    final_pth = os.path.join(out_dir, f"{MODEL_NAME}.pth")
    metrics_json = os.path.join(out_dir, f"{MODEL_NAME}_training_metrics.json")

    root_pth = os.path.join(PROJECT_ROOT, "models", "oral-disease.pth")
    root_pkl = os.path.join(PROJECT_ROOT, "models", "oral-disease.pkl")

    hist = {
        "train_loss": [], "train_acc": [],
        "val_loss": [],   "val_acc": [],
        "epoch_time_s": [], "avg_step_time_s": [],
        "lr_history": [],
    }
    best_loss = float('inf')
    no_improve = 0

    print("\nStarting training...")
    for epoch in range(1, NUM_EPOCHS + 1):
        tr_loss, tr_acc, ep_time, step_times = train_epoch(
            model, train_loader, optimizer, criterion, device,
        )
        va_loss, va_acc = validate_epoch(model, test_loader, criterion, device)
        scheduler.step(va_loss)
        cur_lr = optimizer.param_groups[0]['lr']

        hist['train_loss'].append(tr_loss); hist['train_acc'].append(tr_acc)
        hist['val_loss'].append(va_loss); hist['val_acc'].append(va_acc)
        hist['epoch_time_s'].append(ep_time)
        hist['avg_step_time_s'].append(sum(step_times) / max(len(step_times), 1))
        hist['lr_history'].append(cur_lr)

        print(f"Epoch {epoch:03d} | "
              f"TrL {tr_loss:.4f} TrA {tr_acc*100:.2f}% | "
              f"VaL {va_loss:.4f} VaA {va_acc*100:.2f}% | "
              f"LR {cur_lr:.2e} | {ep_time:.1f}s")

        if va_loss < best_loss:
            best_loss = va_loss
            no_improve = 0
            torch.save(model.state_dict(), best_pth)
            torch.save(model.state_dict(), root_pth)
            save_pkl_bundle(
                model, MODEL_NAME, NUM_CLASSES,
                CLASS_NAMES, TASK_MODE, root_pkl,
            )
            print("  -> new best (saved)")
        else:
            no_improve += 1
            if no_improve >= EARLY_STOP_PATIENCE:
                print(f"Early stopping at epoch {epoch}")
                break

    torch.save(model.state_dict(), final_pth)
    with open(metrics_json, "w") as f:
        json.dump(hist, f, indent=2)
    plot_training_metrics(metrics_path=metrics_json)

    print(f"\nBest val loss: {best_loss:.4f}")
    print(f"Artifacts: {out_dir}")
    print(f"Backend reads: {root_pth} and {root_pkl}")


if __name__ == "__main__":
    main()
