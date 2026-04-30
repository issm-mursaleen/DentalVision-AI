"""
Train one or more ResNet50 variants. Literal port of Notebooks/Training.ipynb.

Each model gets its own folder at the project root with:
  - <MODEL_NAME>_best.pth                # best by val loss
  - <MODEL_NAME>.pth                     # final epoch
  - <MODEL_NAME>_training_metrics.json   # per-epoch history
  - <MODEL_NAME>_training_metrics.png    # train/val curves
  - <MODEL_NAME>_summary.txt             # torchinfo summary

After all variants train, the best (lowest val loss) is copied to project root as
`best_model.pth` + `best_model.pkl` so the FastAPI backend picks it up.

Usage:
    python ml/train.py                                # train default model_list
    python ml/train.py "ResNet50_mod2_weighted"       # train a single variant
"""
import json
import os
import pickle
import random
import sys
import time

import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.optim.lr_scheduler import ReduceLROnPlateau
from tqdm import tqdm

from data_loader import (
    PROJECT_ROOT, compute_normalized_class_weights, get_loaders,
)
from model import get_model

# CUBLAS_WORKSPACE_CONFIG must be set BEFORE any CUDA call for full determinism.
os.environ.setdefault("CUBLAS_WORKSPACE_CONFIG", ":4096:8")

# --- Configuration --------------------------------------------------------
TRAIN_CSV = os.path.join(PROJECT_ROOT, "data", "train_df_encoded_80_20.csv")
TEST_CSV = os.path.join(PROJECT_ROOT, "data", "test_df_encoded_80_20.csv")

# Default list — ResNet18 variants (~2× faster on Colab and less prone to
# overfitting on the ~1.9k training images than ResNet50). Switch to ResNet50
# variants by passing the name on the command line, or edit this list.
MODEL_LIST = [
    "ResNet18_weighted_scratch",
    "ResNet18_mod2_weighted",
    "ResNet18_mod1_weighted_dp(0.4)",
]

NUM_EPOCHS = 100
BATCH_SIZE = 32
INITIAL_LR = 1e-3
WEIGHT_DECAY = 1e-5
EARLY_STOPING_PATIENCE = 20
REDUCE_LR_PATIENCE = 10
REDUCE_LR_FACTOR = 0.1   # notebook hardcodes 0.1 in the scheduler call
SEED = 3
NUM_CLASSES = 2
CLASS_NAMES = ["Normal", "Abnormal"]
TASK_MODE = "binary"


# --- Reproducibility ------------------------------------------------------

def set_seed(seed: int):
    """Match the notebook's set_seed verbatim."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False
    if hasattr(torch, "use_deterministic_algorithms"):
        try:
            torch.use_deterministic_algorithms(True)
        except Exception:
            torch.use_deterministic_algorithms(True, warn_only=True)


# --- Per-epoch routines (verbatim from notebook) -------------------------

def train_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss, total_correct, total_samples = 0.0, 0, 0
    step_times = []
    epoch_start = time.time()

    for images, labels in tqdm(loader, desc='Train', leave=False):
        step_start = time.time()
        images, labels = images.to(device), labels.to(device).long()

        optimizer.zero_grad()
        outputs = model(images).float()
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        total_loss += loss.item() * labels.size(0)
        preds = outputs.argmax(dim=1)
        total_correct += (preds == labels).sum().item()
        total_samples += labels.size(0)
        step_times.append(time.time() - step_start)

    avg_loss = total_loss / total_samples
    avg_acc = total_correct / total_samples
    epoch_time = time.time() - epoch_start
    return avg_loss, avg_acc, epoch_time, step_times


def validate_epoch(model, loader, criterion, device):
    model.eval()
    total_loss, total_correct, total_samples = 0.0, 0, 0
    with torch.no_grad():
        for images, labels in tqdm(loader, desc='Val', leave=False):
            images, labels = images.to(device), labels.to(device).long()
            outputs = model(images).float()
            loss = criterion(outputs, labels)
            total_loss += loss.item() * labels.size(0)
            preds = outputs.argmax(dim=1)
            total_correct += (preds == labels).sum().item()
            total_samples += labels.size(0)
    return total_loss / total_samples, total_correct / total_samples


# --- Plotting (literal port of plot_training_metrics) --------------------

def plot_training_metrics(metrics_path, model_name=None, save_dir=None, dpi=500):
    with open(metrics_path, "r") as f:
        metrics = json.load(f)

    train_loss = metrics["train_loss"]
    val_loss = metrics["val_loss"]
    train_acc = metrics["train_acc"]
    val_acc = metrics["val_acc"]
    epochs = range(1, len(train_loss) + 1)

    if model_name is None:
        model_name = os.path.splitext(os.path.basename(metrics_path))[0].replace("_metrics", "")
    if save_dir is None:
        save_dir = os.path.dirname(metrics_path)
    os.makedirs(save_dir, exist_ok=True)

    fig, ax1 = plt.subplots(figsize=(12, 7))
    l1 = ax1.plot(epochs, train_loss, 'o-', label='Train Loss', color='tab:red')
    l2 = ax1.plot(epochs, val_loss, 'o--', label='Validation Loss', color='tab:orange')
    ax1.set_xlabel('Epochs', fontsize=12)
    ax1.set_ylabel('Loss', color='tab:red', fontsize=12)
    ax1.tick_params(axis='y', labelcolor='tab:red')
    ax1.grid(True, which='both', linestyle='--', linewidth=0.5)

    ax2 = ax1.twinx()
    l3 = ax2.plot(epochs, train_acc, 's-', label='Train Accuracy', color='tab:blue')
    l4 = ax2.plot(epochs, val_acc, 's--', label='Validation Accuracy', color='tab:cyan')
    ax2.set_ylabel('Accuracy', color='tab:blue', fontsize=12)
    ax2.tick_params(axis='y', labelcolor='tab:blue')

    plt.title(f'{model_name}: Training & Validation Metrics', fontsize=16, pad=40)
    lines = l1 + l2 + l3 + l4
    labels = [line.get_label() for line in lines]
    fig.legend(
        handles=lines, labels=labels,
        loc='upper center', bbox_to_anchor=(0.5, 1.02),
        ncol=4, fontsize='medium', frameon=True,
    )
    fig.tight_layout(rect=[0, 0, 1, 0.96])
    save_path = os.path.join(save_dir, f"{model_name}_training_metrics.png")
    plt.savefig(save_path, dpi=dpi, bbox_inches='tight')
    plt.close()
    print(f"Saved plot: {save_path}")


# --- Backend bundle ------------------------------------------------------

def save_pkl_bundle(model, model_name, num_classes, class_names, task_mode, pkl_path):
    bundle = {
        "model": model,
        "model_name": model_name,
        "num_classes": num_classes,
        "class_names": class_names,
        "task_mode": task_mode,
        "architecture": "resnet50",
    }
    with open(pkl_path, "wb") as f:
        pickle.dump(bundle, f)


# --- Single-model training routine (mirrors notebook's run_training) -----

def run_training(model_name_prefix, train_loader, val_loader, class_weights, device,
                 num_epochs=NUM_EPOCHS, patience=EARLY_STOPING_PATIENCE,
                 lr=INITIAL_LR, weight_decay=WEIGHT_DECAY,
                 dir_path=PROJECT_ROOT):
    model_dir = os.path.join(dir_path, model_name_prefix)
    os.makedirs(model_dir, exist_ok=True)
    print(f"\n=== Training {model_name_prefix} ===")

    model = get_model(name=model_name_prefix, num_classes=NUM_CLASSES, device=device)
    optimizer = optim.Adam(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=lr, weight_decay=weight_decay,
    )
    scheduler = ReduceLROnPlateau(optimizer, mode='min', factor=REDUCE_LR_FACTOR,
                                  patience=REDUCE_LR_PATIENCE)

    if 'weighted' in model_name_prefix:
        criterion = nn.CrossEntropyLoss(weight=class_weights.to(torch.float32))
        print("Using weighted CrossEntropyLoss")
    else:
        criterion = nn.CrossEntropyLoss()

    hist = {
        "train_loss": [], "train_acc": [],
        "val_loss": [],   "val_acc": [],
        "epoch_time_s": [], "avg_step_time_s": [],
        "lr_history": [],
    }
    best_loss = float('inf')
    epochs_no_improve = 0
    best_pth = os.path.join(model_dir, f"{model_name_prefix}_best.pth")
    final_pth = os.path.join(model_dir, f"{model_name_prefix}.pth")

    for epoch in range(1, num_epochs + 1):
        train_loss, train_acc, epoch_time, step_times = train_epoch(
            model, train_loader, optimizer, criterion, device,
        )
        val_loss, val_acc = validate_epoch(model, val_loader, criterion, device)
        scheduler.step(val_loss)

        hist["train_loss"].append(train_loss)
        hist["train_acc"].append(train_acc)
        hist["val_loss"].append(val_loss)
        hist["val_acc"].append(val_acc)
        hist["epoch_time_s"].append(epoch_time)
        hist["avg_step_time_s"].append(sum(step_times) / max(len(step_times), 1))
        hist["lr_history"].append(optimizer.param_groups[0]['lr'])

        print(f"Epoch {epoch:02d}: Train Loss={train_loss:.4f}, Acc={train_acc*100:.2f}% | "
              f"Val Loss={val_loss:.4f}, Acc={val_acc*100:.2f}% | "
              f"LR={hist['lr_history'][-1]:.6f}")

        if val_loss < best_loss:
            best_loss = val_loss
            torch.save(model.state_dict(), best_pth)
            epochs_no_improve = 0
            print("  -> New best model saved")
        else:
            epochs_no_improve += 1
            if epochs_no_improve >= patience:
                print(f"Early stopping at epoch {epoch}")
                break

    torch.save(model.state_dict(), final_pth)

    metrics_path = os.path.join(model_dir, f"{model_name_prefix}_training_metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(hist, f, indent=4)
    print(f"Metrics written to {metrics_path}")

    plot_training_metrics(metrics_path=metrics_path)

    # torchinfo summary (best-effort; falls back gracefully if not installed)
    try:
        from torchinfo import summary as ti_summary
        summary_str = str(ti_summary(model, input_size=(BATCH_SIZE, 3, 224, 224)))
        with open(os.path.join(model_dir, f"{model_name_prefix}_summary.txt"),
                  "w", encoding="utf-8") as f:
            f.write(summary_str)
    except ImportError:
        print("torchinfo not installed — skipping model summary")
    except Exception as e:
        print(f"Could not generate torchinfo summary: {e}")

    return {"model": model, "best_loss": best_loss, "model_dir": model_dir,
            "best_pth": best_pth}


# --- Main -----------------------------------------------------------------

def main():
    set_seed(SEED)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    if not (os.path.exists(TRAIN_CSV) and os.path.exists(TEST_CSV)):
        sys.exit(
            "Missing CSV manifests. Run `python ml/dataset_split.py` first.\n"
            f"Expected:\n  {TRAIN_CSV}\n  {TEST_CSV}"
        )

    train_loader, test_loader, train_df, test_df = get_loaders(
        TRAIN_CSV, TEST_CSV, batch_size=BATCH_SIZE,
    )
    print(f"Train: {len(train_df)} | Test: {len(test_df)}")
    print(f"  Train  Normal: {(train_df['label']==0).sum()}  Abnormal: {(train_df['label']==1).sum()}")
    print(f"  Test   Normal: {(test_df['label']==0).sum()}   Abnormal: {(test_df['label']==1).sum()}")

    class_weights = compute_normalized_class_weights(
        train_df, num_classes=NUM_CLASSES, device=device,
    )
    print(f"Normalized class weights: {class_weights.tolist()}  "
          f"(ratio: {(class_weights[1]/class_weights[0]).item():.3f})")

    targets = [sys.argv[1]] if len(sys.argv) > 1 else MODEL_LIST
    print(f"Variants to train: {targets}")

    results = []
    for name in targets:
        result = run_training(
            model_name_prefix=name,
            train_loader=train_loader,
            val_loader=test_loader,        # notebook uses test as val
            class_weights=class_weights,
            device=device,
        )
        result["name"] = name
        results.append(result)

    # Pick winner by lowest val loss and copy to project root for backend pickup.
    if results:
        winner = min(results, key=lambda r: r["best_loss"])
        print(f"\nBest variant: {winner['name']}  (val_loss={winner['best_loss']:.4f})")

        winner_state = torch.load(winner["best_pth"], map_location=device)
        winner_model = get_model(
            name=winner["name"], num_classes=NUM_CLASSES, device=device,
        )
        winner_model.load_state_dict(winner_state)
        winner_model.eval()

        root_pth = os.path.join(PROJECT_ROOT, "models", "oral-binary.pth")
        root_pkl = os.path.join(PROJECT_ROOT, "models", "oral-binary.pkl")
        torch.save(winner_state, root_pth)
        save_pkl_bundle(
            winner_model, winner["name"], NUM_CLASSES,
            CLASS_NAMES, TASK_MODE, root_pkl,
        )
        print(f"Copied winner to {root_pth} and {root_pkl}")


if __name__ == "__main__":
    main()
