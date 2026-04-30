"""
5-fold cross-validation for hyperparameter / variant comparison.
Mirrors `Notebooks/Hyperparameter Tuning.ipynb`.

Usage:
    python ml/kfold.py                                # default model_list
    python ml/kfold.py "ResNet50_mod2_weighted"        # single model

Outputs into runs/<model_name>/:
  - <model>_fold<k>_best.pth
  - <model>_kfold_metrics.json   (per-fold + aggregated mean ± std)
"""
import json
import os
import sys
import time

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.model_selection import KFold
from torch.optim.lr_scheduler import ReduceLROnPlateau
from torch.utils.data import DataLoader, Subset

from data_loader import (
    ImageDataset, PROJECT_ROOT, compute_normalized_class_weights, get_transform,
)
from model import get_model
from train import set_seed, train_epoch, validate_epoch as validate

TRAIN_CSV = os.path.join(PROJECT_ROOT, "data", "train_df_encoded_80_20.csv")
NUM_FOLDS = 5
NUM_EPOCHS = 100
BATCH_SIZE = 32
INITIAL_LR = 1e-3
WEIGHT_DECAY = 1e-5
EARLY_STOP_PATIENCE = 20
REDUCE_LR_PATIENCE = 10
REDUCE_LR_FACTOR = 0.1
SEED = 3


def run_kfold(model_name: str):
    set_seed(SEED)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    if not os.path.exists(TRAIN_CSV):
        sys.exit(f"Missing {TRAIN_CSV}. Run `python ml/dataset_split.py` first.")

    train_df = pd.read_csv(TRAIN_CSV)
    dataset = ImageDataset(train_df, transform=get_transform())
    weights = compute_normalized_class_weights(train_df, num_classes=2, device=device)

    out_dir = os.path.join(PROJECT_ROOT, "runs", model_name)
    os.makedirs(out_dir, exist_ok=True)

    kf = KFold(n_splits=NUM_FOLDS, shuffle=True, random_state=SEED)
    all_folds = []

    print(f"\n=== K-fold CV: {model_name} ({NUM_FOLDS} folds) ===")

    for fold, (tr_idx, va_idx) in enumerate(kf.split(dataset), 1):
        print(f"\n--- Fold {fold}/{NUM_FOLDS} ---")
        train_loader = DataLoader(Subset(dataset, tr_idx), batch_size=BATCH_SIZE, shuffle=True)
        val_loader = DataLoader(Subset(dataset, va_idx), batch_size=BATCH_SIZE, shuffle=False)

        model = get_model(name=model_name, num_classes=2, device=device)
        criterion = (
            nn.CrossEntropyLoss(weight=weights) if "weighted" in model_name
            else nn.CrossEntropyLoss()
        )
        optimizer = optim.Adam(
            filter(lambda p: p.requires_grad, model.parameters()),
            lr=INITIAL_LR, weight_decay=WEIGHT_DECAY,
        )
        scheduler = ReduceLROnPlateau(
            optimizer, mode='min', factor=REDUCE_LR_FACTOR, patience=REDUCE_LR_PATIENCE,
        )

        hist = {"train_loss": [], "train_acc": [], "val_loss": [], "val_acc": [], "lr": []}
        best_loss = float('inf')
        no_improve = 0
        best_pth = os.path.join(out_dir, f"{model_name}_fold{fold}_best.pth")

        for epoch in range(1, NUM_EPOCHS + 1):
            t0 = time.time()
            tr_loss, tr_acc, _, _ = train_epoch(model, train_loader, optimizer, criterion, device)
            va_loss, va_acc = validate(model, val_loader, criterion, device)
            scheduler.step(va_loss)
            cur_lr = optimizer.param_groups[0]['lr']
            hist['train_loss'].append(tr_loss); hist['train_acc'].append(tr_acc)
            hist['val_loss'].append(va_loss); hist['val_acc'].append(va_acc)
            hist['lr'].append(cur_lr)

            print(f"  E{epoch:03d}: TrL {tr_loss:.4f} VaL {va_loss:.4f} "
                  f"VaA {va_acc*100:.2f}% LR {cur_lr:.2e} {time.time()-t0:.1f}s")

            if va_loss < best_loss:
                best_loss = va_loss
                no_improve = 0
                torch.save(model.state_dict(), best_pth)
            else:
                no_improve += 1
                if no_improve >= EARLY_STOP_PATIENCE:
                    print(f"  Early stopping at epoch {epoch}")
                    break

        all_folds.append(hist)

    def agg(key):
        arr = [np.array(f[key]) for f in all_folds]
        m = min(len(a) for a in arr)
        s = np.stack([a[:m] for a in arr])
        return s.mean(0), s.std(0)

    val_loss_mean, val_loss_std = agg("val_loss")
    val_acc_mean, val_acc_std = agg("val_acc")

    print(f"\n=== {model_name} — final-epoch summary across folds ===")
    print(f"  Val loss: {val_loss_mean[-1]:.4f} ± {val_loss_std[-1]:.4f}")
    print(f"  Val acc : {val_acc_mean[-1]*100:.2f}% ± {val_acc_std[-1]*100:.2f}%")

    summary = {
        "per_fold": all_folds,
        "val_loss_mean": val_loss_mean.tolist(),
        "val_loss_std":  val_loss_std.tolist(),
        "val_acc_mean":  val_acc_mean.tolist(),
        "val_acc_std":   val_acc_std.tolist(),
    }
    with open(os.path.join(out_dir, f"{model_name}_kfold_metrics.json"), "w") as f:
        json.dump(summary, f, indent=2)
    print(f"Saved metrics to {out_dir}")


if __name__ == "__main__":
    default_list = [
        "ResNet18_mod1_weighted_dp(0.4)",
        "ResNet18_mod2_weighted",
    ]
    targets = [sys.argv[1]] if len(sys.argv) > 1 else default_list
    for name in targets:
        run_kfold(name)
