"""
Build train/test CSV manifests from the SMART-OM dataset.

Mirrors the protocol in `Notebooks/Data Analysis and Split.ipynb`:
  - Walk SMART-OM/<nature>/01. Unannotated/<site>/* for the 4 nature classes.
  - Encode binary label: Normal=0, Abnormal=1 (covers Variation/OPMD/Cancer).
  - Stratify train/test by `nature + site` where the group has at least 2 samples;
    singleton groups go entirely to train.
  - 80/20 split with deterministic seed=3.

Run once before training:
    python ml/dataset_split.py

Outputs to project root:
  - train_df_encoded_80_20.csv
  - test_df_encoded_80_20.csv
"""
import glob
import os

import pandas as pd
from sklearn.model_selection import train_test_split

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DATASET_ROOT = os.path.join(PROJECT_ROOT, "SMART-OM")
DATA_DIR = os.path.join(PROJECT_ROOT, "data")

NATURE_CLASSES = ["01. Normal", "02. Variation from normal", "03. OPMD", "04. Oral Cancer"]
UNANNOTATED_SUBDIR = "01. Unannotated"
SEED = 3
TEST_SIZE = 0.2
IMG_EXTS = ('.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG')


def _strip_prefix(name: str) -> str:
    """'01. Normal' -> 'Normal'; 'Dorsal tongue' unchanged."""
    return name.split('. ', 1)[-1] if '. ' in name else name


def build_dataframe(root: str = DATASET_ROOT) -> pd.DataFrame:
    rows = []
    for nature in NATURE_CLASSES:
        nature_dir = os.path.join(root, nature, UNANNOTATED_SUBDIR)
        if not os.path.isdir(nature_dir):
            print(f"[WARN] Missing folder: {nature_dir}")
            continue

        for site in os.listdir(nature_dir):
            site_dir = os.path.join(nature_dir, site)
            if not os.path.isdir(site_dir):
                continue
            for path in glob.glob(os.path.join(site_dir, '*')):
                if path.endswith(IMG_EXTS):
                    rows.append({
                        "image_path": path,
                        "nature": _strip_prefix(nature),
                        "site": _strip_prefix(site),
                    })
    df = pd.DataFrame(rows)
    df['label'] = (df['nature'].str.lower() != 'normal').astype(int)
    return df


def stratified_split(df: pd.DataFrame, seed: int = SEED, test_size: float = TEST_SIZE):
    df = df.copy()
    # Match the notebook's nature-name shortening before building the stratify key
    # (does not affect labels, which were computed earlier from the lowercase check).
    df['nature'] = df['nature'].replace({
        'Variation from normal': 'Var',
        'Oral Cancer': 'OC',
    })
    df['stratify_key'] = df['nature'] + ' - ' + df['site']

    counts = df['stratify_key'].value_counts()
    keep = counts[counts >= 2].index
    strat = df[df['stratify_key'].isin(keep)].reset_index(drop=True)
    rare = df[~df['stratify_key'].isin(keep)].reset_index(drop=True)

    train_strat, test_df = train_test_split(
        strat, test_size=test_size,
        stratify=strat['stratify_key'], random_state=seed,
    )
    train_df = pd.concat([train_strat, rare], ignore_index=True)

    for d in (train_df, test_df):
        d.drop(columns=['stratify_key'], inplace=True)
    return train_df.reset_index(drop=True), test_df.reset_index(drop=True)


# Stage 2 (disease classifier): re-encode the abnormal samples into 3 classes.
DISEASE_NATURE_TO_LABEL = {
    'Variation from normal': 0,
    'Var': 0,
    'OPMD': 1,
    'Oral Cancer': 2,
    'OC': 2,
}
DISEASE_CLASS_NAMES = ['Variation', 'OPMD', 'Oral Cancer']


def build_disease_csvs(train_csv: str, test_csv: str,
                       out_train_csv: str, out_test_csv: str):
    """Filter abnormal rows from the binary CSVs and re-encode nature → 3-class."""
    print("\nBuilding disease (3-class) CSVs from abnormal subset:")
    for src, dst in [(train_csv, out_train_csv), (test_csv, out_test_csv)]:
        df = pd.read_csv(src)
        df = df[df['label'] == 1].copy()                 # abnormal only
        df['label'] = df['nature'].map(DISEASE_NATURE_TO_LABEL)
        df = df.dropna(subset=['label']).copy()
        df['label'] = df['label'].astype(int)
        df.to_csv(dst, index=False)
        print(f"  {os.path.basename(dst)}: {len(df)} samples")
        for cls_idx, cls_name in enumerate(DISEASE_CLASS_NAMES):
            print(f"    [{cls_idx}] {cls_name}: {(df['label']==cls_idx).sum()}")


def main():
    print(f"Scanning dataset: {DATASET_ROOT}")
    df = build_dataframe()
    if df.empty:
        raise SystemExit("No images found. Check DATASET_ROOT and folder layout.")

    dups = df[df.duplicated(subset='image_path', keep=False)]
    if not dups.empty:
        print(f"[WARN] {len(dups)} duplicate image_paths detected.")

    train_df, test_df = stratified_split(df)

    print(f"\nTotal samples: {len(df)}")
    print(f"Train: {len(train_df)} | Test: {len(test_df)}")
    print(f"\nTrain — abnormal: {(train_df['label']==1).sum()} | normal: {(train_df['label']==0).sum()}")
    print(f"Test  — abnormal: {(test_df['label']==1).sum()} | normal: {(test_df['label']==0).sum()}")

    os.makedirs(DATA_DIR, exist_ok=True)
    train_csv = os.path.join(DATA_DIR, "train_df_encoded_80_20.csv")
    test_csv = os.path.join(DATA_DIR, "test_df_encoded_80_20.csv")
    train_df.to_csv(train_csv, index=False)
    test_df.to_csv(test_csv, index=False)
    print(f"\nSaved binary CSVs:\n  {train_csv}\n  {test_csv}")

    disease_train = os.path.join(DATA_DIR, "train_df_disease.csv")
    disease_test = os.path.join(DATA_DIR, "test_df_disease.csv")
    build_disease_csvs(train_csv, test_csv, disease_train, disease_test)
    print(f"\nSaved disease CSVs:\n  {disease_train}\n  {disease_test}")


if __name__ == "__main__":
    main()
