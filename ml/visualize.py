import matplotlib.pyplot as plt
import numpy as np
import torch
from data_loader import OralDataset, get_train_transforms

def imshow(img_tensor):
    """Denormalize and convert tensor to numpy for plotting."""
    # Convert from [C, H, W] to [H, W, C]
    img = img_tensor.numpy().transpose((1, 2, 0))
    # Denormalize
    mean = np.array([0.485, 0.456, 0.406])
    std = np.array([0.229, 0.224, 0.225])
    img = std * img + mean
    img = np.clip(img, 0, 1)
    return img

def main():
    # Load dataset with training transforms (which includes random augmentations)
    transform = get_train_transforms()
    dataset = OralDataset(root_dir="../SMART-OM", transform=transform)
    
    if len(dataset) == 0:
        print("No images found in the dataset.")
        return

    # Plot 4 random augmentations of the same image (index 0)
    fig, axes = plt.subplots(1, 4, figsize=(16, 4))
    for i in range(4):
        img_tensor, lbl = dataset[0]
        
        img_np = imshow(img_tensor)
        axes[i].imshow(img_np)
        axes[i].axis('off')
        axes[i].set_title(f"Augmentation {i+1}" if i > 0 else f"Augmentation {i+1} (Label: {lbl})")

    # Save to disk for visual inspection
    output_path = "augmentations_sample.png"
    plt.savefig(output_path, bbox_inches='tight')
    print(f"Saved visually inspected variations to {output_path}")

if __name__ == "__main__":
    main()
