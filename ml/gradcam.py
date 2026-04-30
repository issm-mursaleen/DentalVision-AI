import cv2
import numpy as np
import torch
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image
from torchvision import transforms
from model import get_resnet50_model
from PIL import Image

def generate_heatmap(image_path, model_path="best_model.pth", out_path="gradcam_output.jpg"):
    print(f"Generating Grad-CAM for {image_path}...")
    
    # Fallback to an uninitialized random net if best_model isn't heavily trained yet
    model = get_resnet50_model(num_classes=4) # Using 4 classes matching the dataset mapping 
    try:
        model.load_state_dict(torch.load(model_path, map_location="cpu"))
        print(f"Loaded weights from {model_path}.")
    except Exception as e:
        print(f"Using uninitialized features for testing visualization because: {e}")
        
    model.eval()

    # The last convolutional bottleneck block in Resnet50 is model.layer4[-1]
    target_layers = [model.layer4[-1]]
    
    # Ensure gradients can flow backward to the target convolutional layer
    for param in target_layers[0].parameters():
        param.requires_grad = True
        
    cam = GradCAM(model=model, target_layers=target_layers)

    img = cv2.imread(image_path)
    if img is None:
        print(f"Failed to read image at {image_path}")
        return
        
    rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    rgb_img = cv2.resize(rgb_img, (224, 224))
    
    # Normalize original image mathematically to overlay the Heatmap smoothly ([0, 1] range)
    rgb_img_float = np.float32(rgb_img) / 255.0
    
    # Required transforms for model normalization space
    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225))
    ])
    
    pil_img = Image.fromarray(rgb_img)
    input_tensor = transform(pil_img).unsqueeze(0)

    # 1. Compute gradients and get the Class Activation Map
    grayscale_cam = cam(input_tensor=input_tensor, targets=None) # Extracts Max target category 
    grayscale_cam = grayscale_cam[0, :]

    # 2. Overlay heatmap on original image utilizing OpenCV colormap
    visualization = show_cam_on_image(rgb_img_float, grayscale_cam, use_rgb=True)
    out_img = cv2.cvtColor(visualization, cv2.COLOR_RGB2BGR)
    
    cv2.imwrite(out_path, out_img)
    print(f"Grad-CAM Heatmap saved at: {out_path}")

if __name__ == "__main__":
    import glob
    import sys
    sys.path.append('.') # Make sure model.py is discoverable
    
    # Search recursively for an image to run the Grad-CAM on
    sample_images = glob.glob("SMART-OM/**/*.jpg", recursive=True) + glob.glob("SMART-OM/**/*.jpeg", recursive=True)
    if sample_images:
        generate_heatmap(sample_images[0], out_path="gradcam_output.jpg")
    else:
        print("No images found to generate Grad-CAM output.")
