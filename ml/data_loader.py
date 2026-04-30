"""
DataFrame-driven dataset (matches Notebooks/Training.ipynb).

Reads CSV manifests produced by `dataset_split.py`.

For the binary stage: no augmentation — Resize + ImageNet normalize, matching
the upstream notebook methodology.

For the disease (3-class) stage: strong albumentations augmentation +
WeightedRandomSampler are used, since the Cancer class only has ~15 samples.
"""
import os

import numpy as np
import pandas as pd
import torch
from PIL import Image
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from torchvision import transforms

import albumentations as A
from albumentations.pytorch import ToTensorV2

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


def get_transform():
    """Notebook-faithful preprocessing: resize → tensor → ImageNet normalize."""
    return transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
    ])


class ImageDataset(Dataset):
    def __init__(self, df: pd.DataFrame, transform=None):
        self.df = df.reset_index(drop=True)
        self.transform = transform

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        path = self.df.loc[idx, 'image_path']
        label = int(self.df.loc[idx, 'label'])
        img = Image.open(path).convert('RGB')
        if self.transform:
            img = self.transform(img)
        return img, torch.tensor(label, dtype=torch.long)


def get_loaders(train_csv: str, test_csv: str, batch_size: int = 32, num_workers: int = 0):
    train_df = pd.read_csv(train_csv)
    test_df = pd.read_csv(test_csv)
    transform = get_transform()
    train_loader = DataLoader(
        ImageDataset(train_df, transform), batch_size=batch_size,
        shuffle=True, num_workers=num_workers,
    )
    test_loader = DataLoader(
        ImageDataset(test_df, transform), batch_size=batch_size,
        shuffle=False, num_workers=num_workers,
    )
    return train_loader, test_loader, train_df, test_df


def compute_normalized_class_weights(df: pd.DataFrame, num_classes: int = 2,
                                     device: str = 'cpu') -> torch.Tensor:
    """
    Inverse-frequency class weights, normalized to sum to 1.

    This is the exact formula used in the notebook — and the reason their loss
    is well-behaved while sklearn's `compute_class_weight('balanced')` produced
    weights of [0.29, 32.92] that destabilized our earlier runs.
    """
    counts = [(df['label'] == c).sum() for c in range(num_classes)]
    inv = [1.0 / max(c, 1) for c in counts]
    total = sum(inv)
    weights = [w / total for w in inv]
    return torch.tensor(weights, dtype=torch.float32, device=device)


# --- Stage 2 (disease classifier) -----------------------------------------
# Strong augmentation + WeightedRandomSampler. The Cancer class has only ~15
# training samples, so without these techniques the model just memorises them.

def get_disease_train_transforms():
    """Strong albumentations pipeline for the 3-class disease stage."""
    return A.Compose([
        A.Resize(height=256, width=256),
        A.RandomResizedCrop(height=224, width=224, scale=(0.7, 1.0),
                            ratio=(0.85, 1.15), p=1.0),
        A.HorizontalFlip(p=0.5),
        A.ShiftScaleRotate(shift_limit=0.06, scale_limit=0.10,
                           rotate_limit=20, border_mode=0, p=0.5),
        A.RandomBrightnessContrast(brightness_limit=0.2, contrast_limit=0.2, p=0.5),
        A.HueSaturationValue(hue_shift_limit=10, sat_shift_limit=15,
                             val_shift_limit=10, p=0.3),
        A.GaussNoise(p=0.2),
        A.CoarseDropout(max_holes=2, max_height=24, max_width=24,
                        min_holes=1, min_height=8, min_width=8,
                        fill_value=0, p=0.2),
        A.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
        ToTensorV2(),
    ])


def get_disease_val_transforms():
    return A.Compose([
        A.Resize(height=224, width=224),
        A.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
        ToTensorV2(),
    ])


class ImageDatasetAlbu(Dataset):
    """Same as ImageDataset but feeds numpy arrays into albumentations."""

    def __init__(self, df: pd.DataFrame, transform=None):
        self.df = df.reset_index(drop=True)
        self.transform = transform

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        path = self.df.loc[idx, 'image_path']
        label = int(self.df.loc[idx, 'label'])
        img = np.array(Image.open(path).convert('RGB'))
        if self.transform:
            img = self.transform(image=img)['image']
        return img, torch.tensor(label, dtype=torch.long)


def get_loaders_disease(train_csv: str, test_csv: str,
                        batch_size: int = 16, num_workers: int = 0):
    """
    Disease (3-class) loaders. The training loader uses:
      - albumentations augmentation (so each rare-class image is seen with variation)
      - WeightedRandomSampler (so each batch is class-balanced)
    The val/test loader uses plain Resize + ImageNet normalize.
    """
    train_df = pd.read_csv(train_csv)
    test_df = pd.read_csv(test_csv)

    train_ds = ImageDatasetAlbu(train_df, get_disease_train_transforms())
    test_ds = ImageDatasetAlbu(test_df, get_disease_val_transforms())

    labels = train_df['label'].values.astype(int)
    num_classes = int(labels.max() + 1)
    counts = np.bincount(labels, minlength=num_classes).astype(np.float64)
    inv = 1.0 / np.maximum(counts, 1.0)
    sample_weights = inv[labels]
    sampler = WeightedRandomSampler(
        weights=torch.as_tensor(sample_weights, dtype=torch.double),
        num_samples=len(sample_weights),
        replacement=True,
    )

    train_loader = DataLoader(train_ds, batch_size=batch_size,
                              sampler=sampler, num_workers=num_workers)
    test_loader = DataLoader(test_ds, batch_size=batch_size,
                             shuffle=False, num_workers=num_workers)
    return train_loader, test_loader, train_df, test_df
