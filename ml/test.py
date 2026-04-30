"""
Evaluate a trained model on the held-out test split (matches Testing.ipynb).

Usage:
    python ml/test.py                                    # default MODEL_NAME
    python ml/test.py "ResNet50_mod2_weighted"           # specific variant

Loads runs/<MODEL_NAME>/<MODEL_NAME>_best.pth, computes:
  Accuracy, Precision, Sensitivity (Recall), Specificity, F1, ROC AUC,
  Avg inference time.
Saves CSV results, confusion matrix, and ROC curve to runs/<MODEL_NAME>/.
"""
import os
import sys
import time

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
import torch
import torch.nn as nn
from sklearn.metrics import (
    accuracy_score, confusion_matrix, f1_score,
    precision_score, recall_score, roc_auc_score, roc_curve,
)
from torch.utils.data import DataLoader
from tqdm import tqdm

from data_loader import ImageDataset, PROJECT_ROOT, get_transform
from model import get_model

DEFAULT_MODEL_NAME = "ResNet18_scratch_fold1"
TEST_CSV = os.path.join(PROJECT_ROOT, "data", "test_df_encoded_80_20.csv")


def evaluate(model_name: str = DEFAULT_MODEL_NAME):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    # Try to find weights in 'runs' or in the project root
    out_dir = os.path.join(PROJECT_ROOT, "runs", model_name)
    weights_path = os.path.join(out_dir, f"{model_name}_best.pth")
    
    if not os.path.exists(weights_path):
        # Fallback: check if the file is directly in the project root
        root_weights_path = os.path.join(PROJECT_ROOT, f"{model_name}_best.pth")
        if os.path.exists(root_weights_path):
            weights_path = root_weights_path
            print(f"Found weights in project root: {weights_path}")
            # Ensure the output directory exists for results
            os.makedirs(out_dir, exist_ok=True)
        else:
            sys.exit(f"Missing weights: {weights_path} (also checked {root_weights_path})\nRun `python ml/train.py` first.")
    
    if not os.path.exists(TEST_CSV):
        sys.exit(f"Missing {TEST_CSV}. Run `python ml/dataset_split.py` first.")

    test_df = pd.read_csv(TEST_CSV)
    loader = DataLoader(
        ImageDataset(test_df, get_transform()),
        batch_size=32, shuffle=False, num_workers=0,
    )

    model = get_model(name=model_name, num_classes=2, device=device)
    model.load_state_dict(torch.load(weights_path, map_location=device))
    model.eval()
    criterion = nn.CrossEntropyLoss()

    y_true, y_pred, y_score = [], [], []
    inf_times = []
    total_loss, total = 0.0, 0

    with torch.no_grad():
        for images, labels in tqdm(loader, desc='Test'):
            images, labels = images.to(device), labels.to(device).long()
            t0 = time.time()
            outputs = model(images)
            inf_times.append(time.time() - t0)
            loss = criterion(outputs, labels)
            total_loss += loss.item() * labels.size(0)
            total += labels.size(0)
            probs = torch.softmax(outputs, dim=1)[:, 1]
            preds = outputs.argmax(dim=1)
            y_true.extend(labels.cpu().numpy())
            y_pred.extend(preds.cpu().numpy())
            y_score.extend(probs.cpu().numpy())

    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel()
    specificity = tn / (tn + fp) if (tn + fp) else 0.0

    metrics = {
        "Loss":                  total_loss / total,
        "Accuracy (%)":          accuracy_score(y_true, y_pred) * 100,
        "Precision (%)":         precision_score(y_true, y_pred, zero_division=0) * 100,
        "Sensitivity (%)":       recall_score(y_true, y_pred, zero_division=0) * 100,
        "Specificity (%)":       specificity * 100,
        "F1 (%)":                f1_score(y_true, y_pred, zero_division=0) * 100,
        "ROC AUC":               roc_auc_score(y_true, y_score),
        "Avg inference time (s)": float(np.sum(inf_times) / total),
    }

    print(f"\n=== {model_name} — test results ===")
    for k, v in metrics.items():
        print(f"  {k}: {v:.4f}")

    pd.DataFrame([metrics]).to_csv(
        os.path.join(out_dir, f"{model_name}_results.csv"), index=False,
    )

    # Confusion matrix
    plt.figure(figsize=(6, 5))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                xticklabels=["Normal", "Abnormal"],
                yticklabels=["Normal", "Abnormal"])
    plt.xlabel("Predicted"); plt.ylabel("True")
    plt.title(f"{model_name} — Confusion Matrix")
    plt.tight_layout()
    plt.savefig(os.path.join(out_dir, f"{model_name}_confusion_matrix.png"), dpi=200)
    plt.close()

    # ROC curve
    fpr, tpr, _ = roc_curve(y_true, y_score)
    plt.figure(figsize=(7, 6))
    plt.plot(fpr, tpr, color='darkorange', lw=2, label=f"AUC = {metrics['ROC AUC']:.4f}")
    plt.plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--')
    plt.xlim([-0.02, 1.0]); plt.ylim([0, 1.02])
    plt.xlabel("False Positive Rate"); plt.ylabel("True Positive Rate")
    plt.title(f"{model_name} — ROC Curve")
    plt.legend(loc="lower right"); plt.grid(alpha=0.3); plt.tight_layout()
    plt.savefig(os.path.join(out_dir, f"{model_name}_roc_curve.png"), dpi=200)
    plt.close()

    print(f"Saved CSV + plots to {out_dir}")
    return metrics


if __name__ == "__main__":
    name = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_MODEL_NAME
    evaluate(name)
