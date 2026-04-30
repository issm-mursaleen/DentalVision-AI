from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import cv2
import numpy as np
import base64
import os
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from ultralytics import YOLO
from supabase import create_client, Client

# Load .env from project root (two levels up from backends/cavity/)
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

app = FastAPI(title="DentalVision AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Supabase client ───────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")

sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
TABLE = "cavity_reports"

# ── YOLO model ────────────────────────────────────────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'models', 'cavity.pt')
print(f"Loading cavity model from: {MODEL_PATH}")
model = YOLO(MODEL_PATH)


# ── Pydantic models ───────────────────────────────────────────────────────────
class InferenceResult(BaseModel):
    cavity_detected: bool
    confidence_score: float
    cavity_count: int
    message: str
    annotated_image_base64: str
    heatmap_image_base64: str

class CVLabResult(BaseModel):
    processed_image_base64: str

class ImageQualityResult(BaseModel):
    blur: str
    brightness: str
    contrast: str
    resolution: str
    overall_score: int
    is_poor_quality: bool


# ── Helpers ───────────────────────────────────────────────────────────────────
def generate_mock_heatmap(img, boxes):
    h, w = img.shape[:2]
    mask = np.zeros((h, w), dtype=np.float32)
    for box in boxes:
        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
        cx = int((x1 + x2) / 2)
        cy = int((y1 + y2) / 2)
        radius = int(max(x2 - x1, y2 - y1) / 1.5)
        cv2.circle(mask, (cx, cy), radius, 1.0, -1)
    k_size = min(w, h) // 4
    if k_size % 2 == 0:
        k_size += 1
    mask_blurred = cv2.GaussianBlur(mask, (k_size, k_size), 0)
    mask_norm = cv2.normalize(mask_blurred, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)
    heatmap_colored = cv2.applyColorMap(mask_norm, cv2.COLORMAP_JET)
    return cv2.addWeighted(heatmap_colored, 0.6, img, 0.4, 0)


def _now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _start_of_day_utc() -> str:
    n = datetime.now(timezone.utc)
    return n.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()


def _days_ago_utc(days: int) -> str:
    n = datetime.now(timezone.utc) - timedelta(days=days)
    return n.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()


def _start_of_month_utc() -> str:
    n = datetime.now(timezone.utc)
    return n.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/")
def read_root():
    return {"message": "Welcome to DentalVision AI API"}


@app.post("/api/detect_cavity", response_model=InferenceResult)
async def detect_cavity(file: UploadFile = File(...)):
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File provided is not an image.")
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image.")

        original_img = img.copy()
        results = model(img)
        res = results[0]
        boxes = res.boxes
        cavity_count = len(boxes)
        cavity_detected = cavity_count > 0

        if cavity_detected:
            max_confidence = float(np.max(boxes.conf.cpu().numpy()))
            msg = f"Potential findings detected in {cavity_count} region(s)."
        else:
            max_confidence = 0.0
            msg = "Clear scan with no anomalies detected by the model."

        annotated_img = res.plot()
        heatmap_img = generate_mock_heatmap(original_img, boxes)

        _, buf = cv2.imencode('.jpg', original_img)
        base64_orig = base64.b64encode(buf).decode('utf-8')
        _, buf = cv2.imencode('.jpg', annotated_img)
        base64_ann = base64.b64encode(buf).decode('utf-8')
        _, buf = cv2.imencode('.jpg', heatmap_img)
        base64_heat = base64.b64encode(buf).decode('utf-8')

        # Persist to Supabase
        sb.table(TABLE).insert({
            "original_img":    base64_orig,
            "annotated_img":   base64_ann,
            "heatmap_img":     base64_heat,
            "confidence":      max_confidence,
            "cavity_count":    cavity_count,
            "cavity_detected": cavity_detected,
            "summary":         msg,
        }).execute()

        return InferenceResult(
            cavity_detected=cavity_detected,
            confidence_score=max_confidence,
            cavity_count=cavity_count,
            message=msg,
            annotated_image_base64=base64_ann,
            heatmap_image_base64=base64_heat,
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error during inference.")


@app.get("/api/reports")
def get_reports(filter: str = 'all'):
    q = sb.table(TABLE).select(
        "id, created_at, original_img, annotated_img, heatmap_img, confidence, cavity_count, summary"
    )
    if filter == 'today':
        q = q.gte("created_at", _start_of_day_utc())
    elif filter == 'week':
        q = q.gte("created_at", _days_ago_utc(7))
    elif filter == 'month':
        q = q.gte("created_at", _start_of_month_utc())

    rows = q.order("created_at", desc=True).execute().data
    return [
        {
            "id":                  r["id"],
            "date_time":           r["created_at"],
            "original_img_base64": r["original_img"],
            "annotated_img_base64":r["annotated_img"],
            "heatmap_img_base64":  r["heatmap_img"],
            "confidence":          r["confidence"],
            "cavity_count":        r["cavity_count"],
            "summary":             r["summary"],
        }
        for r in rows
    ]


@app.delete("/api/reports/{report_id}")
def delete_report(report_id: int):
    res = sb.table(TABLE).delete().eq("id", report_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"message": "Report deleted successfully"}


@app.get("/api/dashboard/stats")
def get_dashboard_stats():
    all_rows = sb.table(TABLE).select("confidence, cavity_count, created_at").execute().data

    today_start  = _start_of_day_utc()
    week_start   = _days_ago_utc(7)
    month_start  = _start_of_month_utc()

    total_predictions = len(all_rows)
    today_processed   = sum(1 for r in all_rows if r["created_at"] >= today_start)
    week_predictions  = sum(1 for r in all_rows if r["created_at"] >= week_start)
    month_predictions = sum(1 for r in all_rows if r["created_at"] >= month_start)
    total_cavities    = sum(r["cavity_count"] for r in all_rows)

    confs = [r["confidence"] for r in all_rows if r["confidence"] is not None]
    average_confidence = round(sum(confs) / len(confs) * 100, 1) if confs else 0.0

    cavities_detected = sum(1 for r in all_rows if r["cavity_count"] > 0)
    success_rate = round(cavities_detected / total_predictions * 100, 1) if total_predictions else 0.0

    return {
        "total_predictions":  total_predictions,
        "today_processed":    today_processed,
        "average_confidence": average_confidence,
        "total_cavities":     total_cavities,
        "success_rate":       success_rate,
        "week_predictions":   week_predictions,
        "month_predictions":  month_predictions,
    }


@app.get("/api/dashboard/charts")
def get_dashboard_charts():
    all_rows = sb.table(TABLE).select("confidence, cavity_count, created_at").execute().data
    now = datetime.now(timezone.utc)

    # Weekly trend (last 7 days)
    week_start = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
    weekly_trend, confidence_trend = [], []
    for i in range(7):
        day = week_start + timedelta(days=i)
        day_end = day + timedelta(days=1)
        day_rows = [
            r for r in all_rows
            if day.isoformat() <= r["created_at"] < day_end.isoformat()
        ]
        confs = [r["confidence"] for r in day_rows if r["confidence"] is not None]
        weekly_trend.append({"name": day.strftime('%a'), "predictions": len(day_rows)})
        confidence_trend.append({
            "name": day.strftime('%a'),
            "avgConfidence": round(sum(confs) / len(confs) * 100, 1) if confs else 0.0,
        })

    # Cavity distribution
    dist = {0: 0, 1: 0, 2: 0, "3+": 0}
    for r in all_rows:
        c = r["cavity_count"]
        if c <= 2:
            dist[c] = dist.get(c, 0) + 1
        else:
            dist["3+"] += 1
    cavities_distribution = [
        {"name": "0 Cavities", "value": dist[0]},
        {"name": "1 Cavity",   "value": dist[1]},
        {"name": "2 Cavities", "value": dist[2]},
        {"name": "3+ Cavities","value": dist["3+"]},
    ]

    # Monthly activity (current month up to today)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_activity = []
    for i in range(now.day):
        day = month_start + timedelta(days=i)
        day_end = day + timedelta(days=1)
        count = sum(
            1 for r in all_rows
            if day.isoformat() <= r["created_at"] < day_end.isoformat()
        )
        monthly_activity.append({"name": str(day.day), "predictions": count})

    return {
        "weekly_trend":          weekly_trend,
        "confidence_trend":      confidence_trend,
        "cavities_distribution": cavities_distribution,
        "monthly_activity":      monthly_activity,
    }


@app.post("/api/image-quality", response_model=ImageQualityResult)
async def check_image_quality(file: UploadFile = File(...)):
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File provided is not an image.")
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image.")

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        mean_intensity = np.mean(gray)

        blur_status       = "Good" if lap_var >= 100 else "Poor"
        brightness_status = "Good" if 50 <= mean_intensity <= 200 else ("Dark" if mean_intensity < 50 else "Overexposed")
        contrast_status   = "Good" if gray.std() >= 20 else "Low"
        h, w              = img.shape[:2]
        resolution_status = "Good" if h >= 300 and w >= 300 else "Poor"

        score = sum(25 for s in [blur_status, brightness_status, contrast_status, resolution_status] if s == "Good")
        return ImageQualityResult(
            blur=blur_status, brightness=brightness_status,
            contrast=contrast_status, resolution=resolution_status,
            overall_score=score, is_poor_quality=score < 75,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/cv_lab", response_model=CVLabResult)
async def cv_lab(file: UploadFile = File(...), technique: str = Form(...), param1: int = Form(0), param2: int = Form(0)):
    try:
        nparr = np.frombuffer(await file.read(), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image")

        res_img = img.copy()
        k = param1 if param1 % 2 != 0 else param1 + 1
        p = max(1, param1)

        if   technique == "grayscale":            res_img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        elif technique == "gaussian_blur":         res_img = cv2.GaussianBlur(img, (max(1, k), max(1, k)), 0)
        elif technique == "median_blur":           res_img = cv2.medianBlur(img, max(1, k))
        elif technique == "sharpening":            res_img = cv2.filter2D(img, -1, np.array([[-1,-1,-1],[-1,9,-1],[-1,-1,-1]]))
        elif technique == "histogram_equalization":
            ycrcb = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb); ycrcb[:,:,0] = cv2.equalizeHist(ycrcb[:,:,0]); res_img = cv2.cvtColor(ycrcb, cv2.COLOR_YCrCb2BGR)
        elif technique == "clahe":
            clahe = cv2.createCLAHE(clipLimit=max(1.0, float(param1)), tileGridSize=(8,8))
            lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB); lab[:,:,0] = clahe.apply(lab[:,:,0]); res_img = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        elif technique == "binary_threshold":
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); _, res_img = cv2.threshold(gray, param1, 255, cv2.THRESH_BINARY)
        elif technique == "adaptive_threshold":
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); bsize = max(3, k); res_img = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, bsize, param2)
        elif technique == "canny_edge":            res_img = cv2.Canny(img, param1, param2)
        elif technique == "sobel_edge":
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); res_img = cv2.convertScaleAbs(np.sqrt(np.square(cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)) + np.square(cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3))))
        elif technique == "erosion":               res_img = cv2.erode(img, np.ones((p, p), np.uint8))
        elif technique == "dilation":              res_img = cv2.dilate(img, np.ones((p, p), np.uint8))
        elif technique == "opening":               res_img = cv2.morphologyEx(img, cv2.MORPH_OPEN, np.ones((p, p), np.uint8))
        elif technique == "closing":               res_img = cv2.morphologyEx(img, cv2.MORPH_CLOSE, np.ones((p, p), np.uint8))
        elif technique == "contour_detection":
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); _, thresh = cv2.threshold(gray, param1, 255, cv2.THRESH_BINARY)
            contours, _ = cv2.findContours(thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE); cv2.drawContours(res_img, contours, -1, (0,255,0), 2)
        elif technique == "segmentation":
            Z = img.reshape((-1,3)).astype(np.float32); _, label, center = cv2.kmeans(Z, max(2, param1), None, (cv2.TERM_CRITERIA_EPS+cv2.TERM_CRITERIA_MAX_ITER,10,1.0), 10, cv2.KMEANS_RANDOM_CENTERS)
            res_img = np.uint8(center)[label.flatten()].reshape(img.shape)

        _, buf = cv2.imencode('.jpg', res_img)
        return CVLabResult(processed_image_base64=base64.b64encode(buf).decode('utf-8'))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
