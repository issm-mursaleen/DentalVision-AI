import asyncio
import base64
import glob
import io
import os
import pickle
import random
import sys
from contextlib import asynccontextmanager
from typing import List

import torch
import cv2
import numpy as np
from PIL import Image, UnidentifiedImageError
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from torchvision import transforms
from pytorch_grad_cam import GradCAM, GradCAMPlusPlus
from pytorch_grad_cam.utils.image import show_cam_on_image
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
sys.path.append(_ROOT)
from ml.model import get_model

# --- Config ---------------------------------------------------------------
# Stage 1: binary (Normal vs Abnormal)
BINARY_MODEL_NAME = "ResNet18_weighted_scratch"
BINARY_PKL = os.environ.get('MODEL_PKL_PATH', os.path.join(_ROOT, 'models', 'oral-binary.pkl'))
BINARY_PTH = os.environ.get('MODEL_PATH', os.path.join(_ROOT, 'models', 'oral-binary.pth'))

# Stage 2: disease (Variation / OPMD / Oral Cancer) — optional
DISEASE_MODEL_NAME = "ResNet18_mod1_weighted_dp(0.5)"
DISEASE_PKL = os.environ.get('DISEASE_PKL_PATH', os.path.join(_ROOT, 'models', 'oral-disease.pkl'))
DISEASE_PTH = os.environ.get('DISEASE_PTH_PATH', os.path.join(_ROOT, 'models', 'oral-disease.pth'))

FALLBACK_BINARY_CLASSES = ['Normal', 'Abnormal']
FALLBACK_DISEASE_CLASSES = ['Variation', 'OPMD', 'Oral Cancer']
MAX_FILE_SIZE_MB = int(os.environ.get('MAX_FILE_SIZE_MB', 10))
ALLOWED_CONTENT_TYPES = {'image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/webp'}

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# Model holders
binary_model = None
binary_cam = None
binary_class_names = FALLBACK_BINARY_CLASSES
binary_model_name = "unknown"

disease_model = None
disease_cam = None
disease_class_names = FALLBACK_DISEASE_CLASSES
disease_model_name = "unknown"


def _load_pkl_bundle(pkl_path: str):
    """Load a pickled bundle and return the contained model. None on failure."""
    if not os.path.exists(pkl_path):
        return None, None, None
    try:
        with open(pkl_path, 'rb') as f:
            bundle = pickle.load(f)
        m = bundle['model'].to(device)
        m.eval()
        names = bundle.get('class_names')
        mname = bundle.get('model_name', 'unknown')
        return m, names, mname
    except Exception as e:
        print(f"WARNING: could not load {pkl_path} — {e}")
        return None, None, None


def _build_cam(m: torch.nn.Module):
    """Build a Grad-CAM++ hook on `model.layer4[-1]` for sharper localisation than plain Grad-CAM."""
    target_layer = m.layer4[-1]
    for p in target_layer.parameters():
        p.requires_grad = True
    return GradCAMPlusPlus(model=m, target_layers=[target_layer])


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Load both stages on startup."""
    global binary_model, binary_cam, binary_class_names, binary_model_name
    global disease_model, disease_cam, disease_class_names, disease_model_name
    print(f"Loading models on device: {device}")

    # ---- Stage 1: binary --------------------------------------------------
    binary_model, names, mname = _load_pkl_bundle(BINARY_PKL)
    if binary_model is not None:
        binary_class_names = names or FALLBACK_BINARY_CLASSES
        binary_model_name = mname
        print(f"[binary] loaded {BINARY_PKL} (model={mname}, classes={binary_class_names})")
    else:
        # Fallback to .pth with correct architecture
        binary_model = get_model(name=BINARY_MODEL_NAME, num_classes=len(FALLBACK_BINARY_CLASSES), device=str(device))
        binary_model_name = BINARY_MODEL_NAME
        if os.path.exists(BINARY_PTH):
            try:
                binary_model.load_state_dict(torch.load(BINARY_PTH, map_location=device))
                print(f"[binary] loaded weights from {BINARY_PTH}")
            except Exception as e:
                print(f"[binary] WARNING: could not load weights — {e}")
        else:
            print(f"[binary] WARNING: no {BINARY_PKL} or {BINARY_PTH} found")
        binary_model.to(device).eval()
    binary_cam = _build_cam(binary_model)

    # ---- Stage 2: disease (optional) -------------------------------------
    disease_model, names, mname = _load_pkl_bundle(DISEASE_PKL)
    if disease_model is not None:
        disease_class_names = names or FALLBACK_DISEASE_CLASSES
        disease_model_name = mname
        disease_cam = _build_cam(disease_model)
        print(f"[disease] loaded {DISEASE_PKL} (model={mname}, classes={disease_class_names})")
    elif os.path.exists(DISEASE_PTH):
        # Fallback to .pth with correct architecture
        disease_model = get_model(name=DISEASE_MODEL_NAME, num_classes=len(FALLBACK_DISEASE_CLASSES), device=str(device))
        disease_model_name = DISEASE_MODEL_NAME
        try:
            disease_model.load_state_dict(torch.load(DISEASE_PTH, map_location=device))
            disease_model.to(device).eval()
            disease_cam = _build_cam(disease_model)
            print(f"[disease] loaded weights from {DISEASE_PTH}")
        except Exception as e:
            print(f"[disease] WARNING: could not load disease weights — {e}")
            disease_model = None
    else:
        print(f"[disease] not present — /predict will return only the binary result.")

    print("API ready.")
    yield


app = FastAPI(
    title="Digital Eye — Oral Diagnostics API",
    description="Hierarchical inference: binary (Normal vs Abnormal) → disease (Variation/OPMD/Cancer).",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Image preprocessing --------------------------------------------------

_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
])


def prepare_image(image_bytes: bytes):
    """Decode raw bytes → (input_tensor, original_PIL_image)."""
    try:
        raw_img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    except UnidentifiedImageError:
        raise HTTPException(status_code=422, detail="Uploaded file is not a valid image.")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not decode image: {e}")

    tensor_img = _transform(raw_img).unsqueeze(0)
    return tensor_img, raw_img


def _classify(m: torch.nn.Module, tensor: torch.Tensor):
    with torch.no_grad():
        logits = m(tensor)
        probs = torch.nn.functional.softmax(logits, dim=1)
        score, pred = torch.max(probs, 1)
    return int(pred.item()), float(score.item()), probs[0].cpu().tolist()


def _gradcam_overlay(cam_obj: GradCAM, tensor: torch.Tensor, raw_img: Image.Image,
                     target_class: int = None,
                     label_text: str = None,
                     percentile: float = 75.0) -> str:
    """
    Render a high-resolution Grad-CAM annotation:
      - upsamples the 224×224 CAM to the *original* image size for sharp detail
      - smooths with a Gaussian blur to remove speckle
      - keeps only activations above the given percentile (top quartile by default)
      - draws a bounding box around the strongest contiguous cluster (the ROI)
      - writes a class label tag near the bounding box
    """
    targets = [ClassifierOutputTarget(target_class)] if target_class is not None else None
    heatmap_low = cam_obj(input_tensor=tensor, targets=targets)[0]   # 224×224

    # --- upscale to original resolution ---
    rgb_orig = np.array(raw_img)               # H, W, 3
    h, w = rgb_orig.shape[:2]
    heatmap = cv2.resize(heatmap_low, (w, h), interpolation=cv2.INTER_CUBIC)

    # --- smoothing (kernel scales with image size) ---
    k = max(15, (min(h, w) // 30) | 1)         # odd kernel
    heatmap = cv2.GaussianBlur(heatmap, (k, k), 0)

    # --- percentile threshold ---
    cutoff = float(np.percentile(heatmap, percentile))
    heatmap_thr = np.where(heatmap > cutoff, heatmap, 0).astype(np.float32)
    if heatmap_thr.max() > 0:
        heatmap_thr = heatmap_thr / heatmap_thr.max()

    # --- coloured overlay (preserve anatomy with image_weight=0.6) ---
    rgb_float = np.float32(rgb_orig) / 255.0
    overlay = show_cam_on_image(rgb_float, heatmap_thr, use_rgb=True, image_weight=0.6)

    # --- bounding box around the largest activation cluster ---
    binary_mask = (heatmap_thr > 0.4).astype(np.uint8) * 255
    binary_mask = cv2.morphologyEx(
        binary_mask, cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)),
    )
    contours, _ = cv2.findContours(binary_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if contours:
        # Keep contours with non-trivial area
        min_area = (h * w) * 0.005   # 0.5% of image
        contours = [c for c in contours if cv2.contourArea(c) >= min_area]

    if contours:
        largest = max(contours, key=cv2.contourArea)
        x, y, bw, bh = cv2.boundingRect(largest)
        thickness = max(2, min(h, w) // 250)
        cv2.rectangle(overlay, (x, y), (x + bw, y + bh), (255, 60, 60), thickness)

        if label_text:
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = max(0.5, min(h, w) / 900.0)
            font_thickness = max(1, thickness // 2)
            (tw, th), baseline = cv2.getTextSize(label_text, font, font_scale, font_thickness)
            tx, ty = x, max(th + 6, y - 6)
            cv2.rectangle(
                overlay,
                (tx, ty - th - baseline - 4),
                (tx + tw + 8, ty + 2),
                (255, 60, 60), -1,
            )
            cv2.putText(
                overlay, label_text,
                (tx + 4, ty - baseline),
                font, font_scale, (255, 255, 255), font_thickness, cv2.LINE_AA,
            )

    overlay_bgr = cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR)
    _, buffer = cv2.imencode('.jpg', overlay_bgr, [cv2.IMWRITE_JPEG_QUALITY, 92])
    return base64.b64encode(buffer).decode('utf-8')


# --- Routes ---------------------------------------------------------------

@app.get("/", tags=["Health"])
def ping():
    return {"status": "ok", "message": "Digital Eye API is running. Visit /docs for usage."}


@app.get("/health", tags=["Health"])
def health():
    return {
        "status": "ok",
        "device": str(device),
        "binary": {
            "loaded": binary_model is not None,
            "model_name": binary_model_name,
            "class_names": binary_class_names,
        },
        "disease": {
            "loaded": disease_model is not None,
            "model_name": disease_model_name,
            "class_names": disease_class_names,
        },
    }


def _validate_upload(file: UploadFile, payload: bytes):
    """Raise the right HTTPException if the upload isn't a usable image."""
    if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{file.content_type}'. "
                   f"Allowed: {', '.join(sorted(ALLOWED_CONTENT_TYPES))}",
        )
    size_mb = len(payload) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_mb:.1f} MB). Max {MAX_FILE_SIZE_MB} MB.",
        )
    if len(payload) == 0:
        raise HTTPException(status_code=422, detail="Uploaded file is empty.")


def _run_inference(payload: bytes) -> dict:
    """Two-stage inference + Grad-CAM annotation. Returns the response dict."""
    input_tensor, original_image = prepare_image(payload)
    input_tensor = input_tensor.to(device)

    b_idx, b_conf, b_probs = _classify(binary_model, input_tensor)
    response = {
        "binary": {
            "class_index": b_idx,
            "class_name": (
                binary_class_names[b_idx] if b_idx < len(binary_class_names) else "Unknown"
            ),
            "confidence_score": round(b_conf, 4),
            "probabilities": [round(p, 4) for p in b_probs],
        },
        "disease": None,
    }

    is_abnormal = b_idx == 1
    used_cam = binary_cam
    cam_target_class = 1
    if is_abnormal and disease_model is not None:
        try:
            d_idx, d_conf, d_probs = _classify(disease_model, input_tensor)
            response["disease"] = {
                "class_index": d_idx,
                "class_name": (
                    disease_class_names[d_idx] if d_idx < len(disease_class_names) else "Unknown"
                ),
                "confidence_score": round(d_conf, 4),
                "probabilities": [round(p, 4) for p in d_probs],
            }
            used_cam = disease_cam
            cam_target_class = d_idx
        except Exception as e:
            response["disease"] = {"error": f"Disease inference failed: {e}"}

    if response["disease"] and "class_name" in response["disease"]:
        label = f"{response['disease']['class_name']} {response['disease']['confidence_score']*100:.0f}%"
        response["final_label"] = response["disease"]["class_name"]
    else:
        label = f"{response['binary']['class_name']} {response['binary']['confidence_score']*100:.0f}%"
        response["final_label"] = response["binary"]["class_name"]

    try:
        response["heatmap_base64"] = _gradcam_overlay(
            used_cam, input_tensor, original_image,
            target_class=cam_target_class, label_text=label,
        )
    except Exception:
        response["heatmap_base64"] = None

    return response


@app.post("/predict", tags=["Inference"])
async def predict(file: UploadFile = File(...)):
    """Single-image hierarchical prediction with Grad-CAM ROI annotation."""
    payload = await file.read()
    _validate_upload(file, payload)
    try:
        return await asyncio.to_thread(_run_inference, payload)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {e}")


@app.post("/predict_batch", tags=["Inference"])
async def predict_batch(files: List[UploadFile] = File(...)):
    """
    Multi-image prediction. Each file is run through the same hierarchical
    pipeline as `/predict`. Per-file errors are reported inline, so one bad
    upload doesn't fail the whole batch.
    """
    if not files:
        raise HTTPException(status_code=422, detail="No files uploaded.")

    payloads = []
    for f in files:
        data = await f.read()
        payloads.append((f.filename or "image", f.content_type or "", data))

    def _process_all():
        out = []
        for fname, ctype, data in payloads:
            try:
                # Inline validation so a bad item doesn't 4xx the whole batch.
                if ctype and ctype not in ALLOWED_CONTENT_TYPES:
                    raise ValueError(f"Unsupported content_type {ctype!r}")
                size_mb = len(data) / (1024 * 1024)
                if size_mb > MAX_FILE_SIZE_MB:
                    raise ValueError(f"File too large ({size_mb:.1f} MB)")
                if len(data) == 0:
                    raise ValueError("Empty file")
                result = _run_inference(data)
                result["filename"] = fname
                out.append(result)
            except Exception as e:
                out.append({"filename": fname, "error": str(e)})
        return out

    try:
        results = await asyncio.to_thread(_process_all)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch inference failed: {e}")
    return {"count": len(results), "predictions": results}


# --- Reference: healthy / unannotated examples for visual comparison -----

_REFERENCE_DIR = os.path.join(_ROOT, "SMART-OM", "01. Normal", "01. Unannotated")
_REFERENCE_CACHE: List[str] = []


def _list_reference_images() -> List[str]:
    """Discover (and cache) all normal-unannotated image paths once."""
    global _REFERENCE_CACHE
    if _REFERENCE_CACHE:
        return _REFERENCE_CACHE
    if not os.path.isdir(_REFERENCE_DIR):
        return []
    found = []
    for ext in ("*.jpg", "*.jpeg", "*.png", "*.JPG", "*.JPEG", "*.PNG"):
        found.extend(glob.glob(os.path.join(_REFERENCE_DIR, "**", ext), recursive=True))
    _REFERENCE_CACHE = sorted(found)
    return _REFERENCE_CACHE


@app.get("/reference_images", tags=["Reference"])
def reference_images(n: int = 4):
    """
    Returns up to `n` randomly-sampled healthy unannotated reference images
    (base64 JPEG data URIs) so the frontend can show a visual baseline next to
    the user's uploads.
    """
    n = max(1, min(int(n), 12))
    paths = _list_reference_images()
    if not paths:
        return {"reference_images": [], "note": "SMART-OM reference folder not present on server."}

    chosen = random.sample(paths, min(n, len(paths)))
    out = []
    for path in chosen:
        try:
            img = Image.open(path).convert("RGB")
            # Downscale so the response stays small.
            img.thumbnail((640, 640))
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85)
            b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
            site = os.path.basename(os.path.dirname(path))
            out.append({
                "site": site,
                "filename": os.path.basename(path),
                "data_uri": f"data:image/jpeg;base64,{b64}",
            })
        except Exception as e:
            out.append({"filename": os.path.basename(path), "error": str(e)})
    return {"reference_images": out}

