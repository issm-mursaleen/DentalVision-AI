"""
Stage-2 evaluation: 3-class disease classifier on the held-out test split.

Usage:
    python ml/test_disease.py
    python ml/test_disease.py "ResNet18_mod2_weighted_dp(0.5)"

Reports per-class precision/recall/F1, multi-class ROC AUC (one-vs-rest),
and saves a confusion matrix.
"""
import os
import sys
import time

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
import torch
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix,
    f1_score, precision_score, recall_score, roc_auc_score,
)
from torch.utils.data import DataLoader
from tqdm import tqdm

from data_loader import (
    ImageDatasetAlbu, PROJECT_ROOT, get_disease_val_transforms,
)
from model import get_model

DEFAULT_MODEL_NAME = "ResNet18_mod1_weighted_dp(0.5)"
TEST_CSV = os.path.join(PROJECT_ROOT, "data", "test_df_disease.csv")
CLASS_NAMES = ["Variation", "OPMD", "Oral Cancer"]


def evaluate(model_name: str = DEFAULT_MODEL_NAME):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    # Try to find weights in 'disease_<name>' or in the project root as 'disease_best_model.pth'
    out_dir = os.path.join(PROJECT_ROOT, f"disease_{model_name}")
    weights_path = os.path.join(out_dir, f"{model_name}_best.pth")
    
    if not os.path.exists(weights_path):
        # Specific Fallback for the user's file: disease_best_model.pth
        root_weights_path = os.path.join(PROJECT_ROOT, "disease_best_model.pth")
        if os.path.exists(root_weights_path):
            weights_path = root_weights_path
            print(f"Found weights in project root: {weights_path}")
            os.makedirs(out_dir, exist_ok=True)
        else:
            sys.exit(f"Missing weights: {weights_path} (also checked {root_weights_path})\nRun `python ml/train_disease.py` first.")
    if not os.path.exists(TEST_CSV):
        sys.exit(f"Missing {TEST_CSV}. Run `python ml/dataset_split.py` first.")

    test_df = pd.read_csv(TEST_CSV)
    loader = DataLoader(
        ImageDatasetAlbu(test_df, get_disease_val_transforms()),
        batch_size=16, shuffle=False, num_workers=0,
    )

    model = get_model(name=model_name, num_classes=len(CLASS_NAMES), device=device)
    model.load_state_dict(torch.load(weights_path, map_location=device))
    model.eval()

    y_true, y_pred, y_score = [], [], []
    inf_times = []

    with torch.no_grad():
        for images, labels in tqdm(loader, desc='Test'):
            images, labels = images.to(device), labels.to(device).long()
            t0 = time.time()
            outputs = model(images)
            inf_times.append(time.time() - t0)
            probs = torch.softmax(outputs, dim=1)
            y_true.extend(labels.cpu().numpy())
            y_pred.extend(outputs.argmax(dim=1).cpu().numpy())
            y_score.extend(probs.cpu().numpy())

    y_true = np.array(y_true)
    y_pred = np.array(y_pred)
    y_score = np.array(y_score)

    cm = confusion_matrix(y_true, y_pred, labels=list(range(len(CLASS_NAMES))))

    metrics = {
        "Accuracy (%)": accuracy_score(y_true, y_pred) * 100,
        "Precision macro (%)": precision_score(y_true, y_pred, average='macro', zero_division=0) * 100,
        "Recall macro (%)": recall_score(y_true, y_pred, average='macro', zero_division=0) * 100,
        "F1 macro (%)": f1_score(y_true, y_pred, average='macro', zero_division=0) * 100,
        "Avg inference time (s)": float(np.sum(inf_times) / max(len(y_true), 1)),
    }
    try:
        metrics["ROC AUC (OvR)"] = roc_auc_score(y_true, y_score, multi_class='ovr')
    except ValueError as e:
        # Happens if a class has no positives in the test split.
        print(f"[note] ROC AUC unavailable: {e}")
        metrics["ROC AUC (OvR)"] = float('nan')

    print(f"\n=== {model_name} — disease test results ===")
    for k, v in metrics.items():
        print(f"  {k}: {v:.4f}")

    print("\nClassification report:")
    print(classification_report(
        y_true, y_pred, target_names=CLASS_NAMES, zero_division=0, digits=4,
    ))

    pd.DataFrame([metrics]).to_csv(
        os.path.join(out_dir, f"{model_name}_results.csv"), index=False,
    )

    plt.figure(figsize=(7, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                xticklabels=CLASS_NAMES, yticklabels=CLASS_NAMES)
    plt.xlabel("Predicted"); plt.ylabel("True")
    plt.title(f"{model_name} — Disease Confusion Matrix")
    plt.tight_layout()
    plt.savefig(os.path.join(out_dir, f"{model_name}_confusion_matrix.png"), dpi=200)
    plt.close()

    print(f"Saved CSV + confusion matrix to {out_dir}")
    return metrics


if __name__ == "__main__":
    name = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_MODEL_NAME
    evaluate(name)
