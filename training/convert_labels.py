"""
Label Converter: Custom polygon/pixel annotations → Standard YOLO bbox format.

Your labels are in the format:
    class_id x1 y1 x2 y2 x3 y3 x4 y4 class_name [extra]
where coordinates are pixel values forming a bounding polygon.

This script converts them to the standard YOLO format:
    class_id  center_x  center_y  width  height
where all values are normalized to [0, 1] relative to image dimensions.
"""

import os
import cv2
import glob

DATASET_ROOT = r"c:\Users\hp\Desktop\DentalVisionAI\cavity_dataset"

# Only process label files where the class name contains "cavity"
# The class index in YOLO output will always be 0
CAVITY_CLASS_ID = 0

def parse_and_convert(label_path, img_path):
    """
    Parse a custom-format label file and convert to YOLO bbox format.
    Returns a list of YOLO-format annotation lines.
    """
    img = cv2.imread(img_path)
    if img is None:
        print(f"  [WARN] Could not read image: {img_path}")
        return None

    img_h, img_w = img.shape[:2]
    yolo_lines = []

    with open(label_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue

            parts = line.split()
            # We expect at least: class_id x1 y1 x2 y2 x3 y3 x4 y4 class_name
            # Some lines have an extra trailing value

            # Extract class name (second-to-last or last element that's a word)
            class_name = None
            coord_parts = []
            for i, p in enumerate(parts):
                try:
                    float(p)
                    coord_parts.append(float(p))
                except ValueError:
                    class_name = p.lower()

            # Only keep cavity annotations
            if class_name != 'cavity':
                continue

            # coord_parts should be: [class_id, x1, y1, x2, y2, x3, y3, x4, y4, ...]
            # Skip class_id (first element), get the coordinate pairs
            coords = coord_parts[1:]  # remove the leading class_id

            # Extract all x and y values from the polygon
            xs = [coords[i] for i in range(0, len(coords), 2)]
            ys = [coords[i] for i in range(1, len(coords), 2)]

            if len(xs) < 2 or len(ys) < 2:
                continue

            # Bounding box from polygon extremes
            x_min = min(xs)
            x_max = max(xs)
            y_min = min(ys)
            y_max = max(ys)

            # Convert to YOLO normalized center format
            cx = ((x_min + x_max) / 2.0) / img_w
            cy = ((y_min + y_max) / 2.0) / img_h
            bw = (x_max - x_min) / img_w
            bh = (y_max - y_min) / img_h

            # Clamp values to [0, 1]
            cx = max(0, min(1, cx))
            cy = max(0, min(1, cy))
            bw = max(0, min(1, bw))
            bh = max(0, min(1, bh))

            if bw > 0 and bh > 0:
                yolo_lines.append(f"{CAVITY_CLASS_ID} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}")

    return yolo_lines


def process_split(split_name):
    """Process all labels in a split (train/val/test)."""
    img_dir = os.path.join(DATASET_ROOT, split_name, "images")
    label_dir = os.path.join(DATASET_ROOT, split_name, "labels")

    if not os.path.exists(img_dir) or not os.path.exists(label_dir):
        print(f"  [SKIP] Missing directories for split '{split_name}'")
        return

    label_files = glob.glob(os.path.join(label_dir, "*.txt"))
    total = len(label_files)
    converted = 0
    skipped = 0
    empty = 0

    print(f"\n  Processing '{split_name}': {total} label files found")

    for lf in label_files:
        basename = os.path.splitext(os.path.basename(lf))[0]

        # Find matching image (try common extensions)
        img_path = None
        for ext in ['.jpg', '.jpeg', '.png', '.bmp']:
            candidate = os.path.join(img_dir, basename + ext)
            if os.path.exists(candidate):
                img_path = candidate
                break

        if img_path is None:
            skipped += 1
            continue

        yolo_lines = parse_and_convert(lf, img_path)
        if yolo_lines is None:
            skipped += 1
            continue

        # Overwrite the label file with YOLO format
        with open(lf, 'w') as f:
            f.write('\n'.join(yolo_lines))

        if len(yolo_lines) == 0:
            empty += 1
        else:
            converted += 1

    print(f"  ✓ Converted: {converted} | Empty (no cavity): {empty} | Skipped: {skipped}")


if __name__ == "__main__":
    print("=" * 60)
    print("  DentalVision AI - Label Format Converter")
    print("  Custom polygon → YOLO bbox (normalized)")
    print("=" * 60)

    for split in ["train", "val", "test"]:
        process_split(split)

    print("\n  Done! Labels are now in standard YOLO format.")
    print("=" * 60)
