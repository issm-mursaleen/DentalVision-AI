"""
ResNet18 / ResNet50 with the variant grammar used in the upstream notebooks.

Backbone is selected by the prefix in the name string:
  - `ResNet18...` → ResNet18 (fc.in_features = 512)
  - `ResNet50...` → ResNet50 (fc.in_features = 2048)

Head/training variant grammar (any combination, separated by `_`):
  - `mod1`     → fc = Linear(in, in)  → ReLU → Dropout(p) → Linear(in, num_classes)
  - `mod2`     → fc = Linear(in, 256) → ReLU → Dropout(p) → Linear(256, num_classes)
  - default    → fc = Linear(in, num_classes)
  - `scratch`  → no pretrained weights, full network trainable
  - `weighted` → caller hint for class-weighted CE (no architectural effect)
  - `dp(0.4)`  → dropout rate (default 0.5 when mod1/mod2 used)

Examples:
  ResNet18_mod1_weighted_dp(0.4)
  ResNet50_mod2_weighted
  ResNet18_weighted_scratch
"""
import re

import torch.nn as nn
from torchvision import models


def _parse_dropout(name: str) -> float:
    m = re.search(r'dp\(([\d.]+)\)', name)
    return float(m.group(1)) if m else 0.5


def _select_backbone(name: str, scratch: bool):
    use_18 = "ResNet18" in name or "resnet18" in name

    if use_18:
        if scratch:
            return models.resnet18(weights=None, zero_init_residual=True)
        try:
            return models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
        except (TypeError, AttributeError):
            return models.resnet18(pretrained=True)

    # default: ResNet50
    if scratch:
        return models.resnet50(weights=None, zero_init_residual=True)
    try:
        return models.resnet50(weights=models.ResNet50_Weights.DEFAULT)
    except (TypeError, AttributeError):
        return models.resnet50(pretrained=True)


def get_model(name: str = "ResNet18_mod1_weighted_dp(0.4)",
              num_classes: int = 2,
              device: str = 'cpu') -> nn.Module:
    scratch = "scratch" in name
    model = _select_backbone(name, scratch)
    in_features = model.fc.in_features
    dropout_p = _parse_dropout(name)

    if scratch:
        model.fc = nn.Linear(in_features, num_classes)
        for p in model.parameters():
            p.requires_grad = True
        return model.to(device)

    # Pretrained: freeze everything, then unfreeze layer4 + new head.
    for p in model.parameters():
        p.requires_grad = False
    for p in model.layer4.parameters():
        p.requires_grad = True

    if "mod2" in name:
        model.fc = nn.Sequential(
            nn.Linear(in_features, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(p=dropout_p),
            nn.Linear(256, num_classes),
        )
    elif "mod1" in name:
        model.fc = nn.Sequential(
            nn.Linear(in_features, in_features),
            nn.ReLU(inplace=True),
            nn.Dropout(p=dropout_p),
            nn.Linear(in_features, num_classes),
        )
    else:
        model.fc = nn.Linear(in_features, num_classes)

    for p in model.fc.parameters():
        p.requires_grad = True

    return model.to(device)


# --- Backward-compat alias used by backend/app.py and ml/gradcam.py -------
# Keeps the existing default-arg call sites working unchanged. New code should
# use get_model() directly.

def get_resnet50_model(name: str = "ResNet50_mod1_weighted_dp(0.4)",
                       num_classes: int = 2,
                       device: str = 'cpu') -> nn.Module:
    return get_model(name=name, num_classes=num_classes, device=device)


if __name__ == "__main__":
    import torch

    for name in [
        "ResNet18",
        "ResNet18_mod1_weighted_dp(0.4)",
        "ResNet18_mod2_weighted",
        "ResNet18_weighted_scratch",
        "ResNet50_mod1_weighted_dp(0.4)",
    ]:
        m = get_model(name=name, num_classes=2)
        n_trainable = sum(p.numel() for p in m.parameters() if p.requires_grad)
        n_total = sum(p.numel() for p in m.parameters())
        with torch.no_grad():
            out = m(torch.randn(1, 3, 224, 224))
        print(f"{name:48s} trainable={n_trainable:>12,} / total={n_total:>12,} "
              f"output={list(out.shape)}")
