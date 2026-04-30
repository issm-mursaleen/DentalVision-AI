from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import cv2
import numpy as np
import base64
import sqlite3
import os
from datetime import datetime, timedelta
from ultralytics import YOLO

app = FastAPI(title="DentalVision AI API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize SQLite Database
def init_db():
    conn = sqlite3.connect('reports.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date_time TEXT,
            original_img TEXT,
            annotated_img TEXT,
            heatmap_img TEXT,
            confidence REAL,
            cavity_count INTEGER,
            summary TEXT
        )
    ''')
    conn.commit()
    conn.close()

init_db()

# Load custom-trained dental cavity detection model (loaded once at startup)
MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'models', 'cavity.pt')
print(f"Loading cavity model from: {MODEL_PATH}")
model = YOLO(MODEL_PATH)

class InferenceResult(BaseModel):
    cavity_detected: bool
    confidence_score: float
    cavity_count: int
    message: str
    annotated_image_base64: str
    heatmap_image_base64: str

class CVLabResult(BaseModel):
    processed_image_base64: str

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
    mask_normalized = cv2.normalize(mask_blurred, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)
    heatmap_colored = cv2.applyColorMap(mask_normalized, cv2.COLORMAP_JET)
    overlay = cv2.addWeighted(heatmap_colored, 0.6, img, 0.4, 0)
    return overlay

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
            conf_scores = boxes.conf.cpu().numpy()
            max_confidence = float(np.max(conf_scores))
            msg = f"Potential findings detected in {cavity_count} region(s)."
        else:
            max_confidence = 0.0
            msg = "Clear scan with no anomalies detected by the model."

        annotated_img = res.plot()
        heatmap_img = generate_mock_heatmap(original_img, boxes)

        # Encode to Base64
        _, buffer_orig = cv2.imencode('.jpg', original_img)
        base64_orig = base64.b64encode(buffer_orig).decode('utf-8')

        _, buffer_ann = cv2.imencode('.jpg', annotated_img)
        base64_ann = base64.b64encode(buffer_ann).decode('utf-8')

        _, buffer_heat = cv2.imencode('.jpg', heatmap_img)
        base64_heat = base64.b64encode(buffer_heat).decode('utf-8')

        # Insert record into database
        conn = sqlite3.connect('reports.db')
        cursor = conn.cursor()
        current_time = datetime.now().isoformat()
        cursor.execute('''
            INSERT INTO reports (date_time, original_img, annotated_img, heatmap_img, confidence, cavity_count, summary)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (current_time, base64_orig, base64_ann, base64_heat, max_confidence, cavity_count, msg))
        conn.commit()
        conn.close()

        return InferenceResult(
            cavity_detected=cavity_detected,
            confidence_score=max_confidence,
            cavity_count=cavity_count,
            message=msg,
            annotated_image_base64=base64_ann,
            heatmap_image_base64=base64_heat
        )

    except Exception as e:
        print(f"Error processing image: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error during inference.")

@app.post("/api/cv_lab", response_model=CVLabResult)
async def cv_lab(
    file: UploadFile = File(...),
    technique: str = Form(...),
    param1: int = Form(0),
    param2: int = Form(0)
):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image")

        res_img = img.copy()
        k_size = param1 if param1 % 2 != 0 else param1 + 1
        p_kernel = max(1, param1)
        
        if technique == "grayscale":
            res_img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        elif technique == "gaussian_blur":
            if k_size < 1: k_size = 1
            res_img = cv2.GaussianBlur(img, (k_size, k_size), 0)
        elif technique == "median_blur":
            if k_size < 1: k_size = 1
            res_img = cv2.medianBlur(img, k_size)
        elif technique == "sharpening":
            kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
            res_img = cv2.filter2D(img, -1, kernel)
        elif technique == "histogram_equalization":
            if len(img.shape) == 3:
                ycrcb = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb)
                ycrcb[:, :, 0] = cv2.equalizeHist(ycrcb[:, :, 0])
                res_img = cv2.cvtColor(ycrcb, cv2.COLOR_YCrCb2BGR)
            else:
                res_img = cv2.equalizeHist(img)
        elif technique == "clahe":
            clahe = cv2.createCLAHE(clipLimit=max(1.0, float(param1)), tileGridSize=(8, 8))
            if len(img.shape) == 3:
                lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
                lab[:, :, 0] = clahe.apply(lab[:, :, 0])
                res_img = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
            else:
                res_img = clahe.apply(img)
        elif technique == "binary_threshold":
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
            _, res_img = cv2.threshold(gray, param1, 255, cv2.THRESH_BINARY)
        elif technique == "adaptive_threshold":
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
            bsize = param1 if param1 % 2 != 0 else param1 + 1
            if bsize < 3: bsize = 3
            res_img = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, bsize, param2)
        elif technique == "canny_edge":
            res_img = cv2.Canny(img, param1, param2)
        elif technique == "sobel_edge":
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
            sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
            sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
            res_img = cv2.convertScaleAbs(np.sqrt(np.square(sobelx) + np.square(sobely)))
        elif technique == "prewitt_edge":
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
            kernelx = np.array([[1,1,1],[0,0,0],[-1,-1,-1]])
            kernely = np.array([[-1,0,1],[-1,0,1],[-1,0,1]])
            img_prewittx = cv2.filter2D(gray, -1, kernelx)
            img_prewitty = cv2.filter2D(gray, -1, kernely)
            res_img = cv2.addWeighted(img_prewittx, 0.5, img_prewitty, 0.5, 0)
        elif technique == "erosion":
            kernel = np.ones((p_kernel, p_kernel), np.uint8)
            res_img = cv2.erode(img, kernel, iterations=1)
        elif technique == "dilation":
            kernel = np.ones((p_kernel, p_kernel), np.uint8)
            res_img = cv2.dilate(img, kernel, iterations=1)
        elif technique == "opening":
            kernel = np.ones((p_kernel, p_kernel), np.uint8)
            res_img = cv2.morphologyEx(img, cv2.MORPH_OPEN, kernel)
        elif technique == "closing":
            kernel = np.ones((p_kernel, p_kernel), np.uint8)
            res_img = cv2.morphologyEx(img, cv2.MORPH_CLOSE, kernel)
        elif technique == "contour_detection":
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
            _, thresh = cv2.threshold(gray, param1, 255, cv2.THRESH_BINARY)
            contours, _ = cv2.findContours(thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
            cv2.drawContours(res_img, contours, -1, (0, 255, 0), 2)
        elif technique == "segmentation":
            Z = img.reshape((-1,3)).astype(np.float32)
            criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
            K = max(2, param1)
            _, label, center = cv2.kmeans(Z, K, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)
            center = np.uint8(center)
            res_img = center[label.flatten()].reshape((img.shape))

        _, buffer = cv2.imencode('.jpg', res_img)
        base64_img = base64.b64encode(buffer).decode('utf-8')

        return CVLabResult(processed_image_base64=base64_img)

    except Exception as e:
        print(f"Error in CV Lab processing: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/reports")
def get_reports(filter: str = 'all'):
    conn = sqlite3.connect('reports.db')
    cursor = conn.cursor()
    
    query = "SELECT id, date_time, original_img, annotated_img, heatmap_img, confidence, cavity_count, summary FROM reports"
    now = datetime.now()

    if filter == 'today':
        start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        query += f" WHERE date_time >= '{start}'"
    elif filter == 'week':
        start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        query += f" WHERE date_time >= '{start}'"
    elif filter == 'month':
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        query += f" WHERE date_time >= '{start}'"

    query += " ORDER BY id DESC"
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()

    reports = []
    for row in rows:
        reports.append({
            "id": row[0],
            "date_time": row[1],
            "original_img_base64": row[2],
            "annotated_img_base64": row[3],
            "heatmap_img_base64": row[4],
            "confidence": row[5],
            "cavity_count": row[6],
            "summary": row[7]
        })
    return reports

@app.delete("/api/reports/{id}")
def delete_report(id: int):
    conn = sqlite3.connect('reports.db')
    cursor = conn.cursor()
    cursor.execute("DELETE FROM reports WHERE id = ?", (id,))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()
    if not deleted:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"message": "Report deleted successfully"}

@app.get("/api/dashboard/stats")
def get_dashboard_stats():
    conn = sqlite3.connect('reports.db')
    cursor = conn.cursor()
    
    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_start = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    cursor.execute("SELECT COUNT(*) FROM reports")
    total_predictions = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM reports WHERE date_time >= ?", (today_start,))
    today_processed = cursor.fetchone()[0]

    cursor.execute("SELECT AVG(confidence) FROM reports")
    avg_conf = cursor.fetchone()[0]
    average_confidence = round(avg_conf * 100, 1) if avg_conf else 0.0

    cursor.execute("SELECT SUM(cavity_count) FROM reports")
    total_cavities = cursor.fetchone()[0] or 0

    cursor.execute("SELECT COUNT(*) FROM reports WHERE cavity_count > 0")
    cavities_detected_count = cursor.fetchone()[0]
    success_rate = round((cavities_detected_count / total_predictions * 100), 1) if total_predictions > 0 else 0.0

    cursor.execute("SELECT COUNT(*) FROM reports WHERE date_time >= ?", (week_start,))
    week_predictions = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM reports WHERE date_time >= ?", (month_start,))
    month_predictions = cursor.fetchone()[0]

    conn.close()

    return {
        "total_predictions": total_predictions,
        "today_processed": today_processed,
        "average_confidence": average_confidence,
        "total_cavities": total_cavities,
        "success_rate": success_rate,
        "week_predictions": week_predictions,
        "month_predictions": month_predictions
    }

@app.get("/api/dashboard/charts")
def get_dashboard_charts():
    conn = sqlite3.connect('reports.db')
    cursor = conn.cursor()
    
    # Weekly Trend
    now = datetime.now()
    week_start = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
    
    weekly_trend = []
    confidence_trend = []
    
    # Initialize the last 7 days including today
    for i in range(7):
        day = week_start + timedelta(days=i)
        day_str_start = day.isoformat()
        day_str_end = (day + timedelta(days=1)).isoformat()
        day_name = day.strftime('%a')
        
        cursor.execute("SELECT COUNT(*), AVG(confidence) FROM reports WHERE date_time >= ? AND date_time < ?", (day_str_start, day_str_end))
        row = cursor.fetchone()
        
        weekly_trend.append({"name": day_name, "predictions": row[0]})
        avg_conf = row[1]
        confidence_trend.append({"name": day_name, "avgConfidence": round(avg_conf * 100, 1) if avg_conf else 0.0})

    # Cavities Distribution
    cursor.execute("SELECT cavity_count, COUNT(*) FROM reports GROUP BY cavity_count")
    rows = cursor.fetchall()
    
    cavity_counts = {0: 0, 1: 0, 2: 0, "3+": 0}
    for count, freq in rows:
        if count == 0:
            cavity_counts[0] += freq
        elif count == 1:
            cavity_counts[1] += freq
        elif count == 2:
            cavity_counts[2] += freq
        else:
            cavity_counts["3+"] += freq
            
    cavities_distribution = [
        {"name": "0 Cavities", "value": cavity_counts[0]},
        {"name": "1 Cavity", "value": cavity_counts[1]},
        {"name": "2 Cavities", "value": cavity_counts[2]},
        {"name": "3+ Cavities", "value": cavity_counts["3+"]}
    ]

    # Monthly Activity
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_activity = []
    days_in_month = now.day # Only show up to current day
    
    for i in range(days_in_month):
        day = month_start + timedelta(days=i)
        day_str_start = day.isoformat()
        day_str_end = (day + timedelta(days=1)).isoformat()
        day_num = str(day.day)
        
        cursor.execute("SELECT COUNT(*) FROM reports WHERE date_time >= ? AND date_time < ?", (day_str_start, day_str_end))
        count = cursor.fetchone()[0]
        monthly_activity.append({"name": day_num, "predictions": count})
        
    conn.close()
    
    return {
        "weekly_trend": weekly_trend,
        "confidence_trend": confidence_trend,
        "cavities_distribution": cavities_distribution,
        "monthly_activity": monthly_activity
    }

class ImageQualityResult(BaseModel):
    blur: str
    brightness: str
    contrast: str
    resolution: str
    overall_score: int
    is_poor_quality: bool

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
        
        # Blur check (Laplacian Variance)
        lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        blur_status = "Good" if lap_var >= 100 else "Poor"
        
        # Brightness check (Mean intensity)
        mean_intensity = np.mean(gray)
        if mean_intensity < 50:
            brightness_status = "Dark"
        elif mean_intensity > 200:
            brightness_status = "Overexposed"
        else:
            brightness_status = "Good"
            
        # Contrast check (Standard deviation)
        std_dev = gray.std()
        contrast_status = "Good" if std_dev >= 20 else "Low"
        
        # Resolution check
        h, w = img.shape[:2]
        resolution_status = "Good" if h >= 300 and w >= 300 else "Poor"
        
        # Overall score
        score = 0
        if blur_status == "Good": score += 25
        if brightness_status == "Good": score += 25
        if contrast_status == "Good": score += 25
        if resolution_status == "Good": score += 25
        
        is_poor_quality = score < 75
        
        return ImageQualityResult(
            blur=blur_status,
            brightness=brightness_status,
            contrast=contrast_status,
            resolution=resolution_status,
            overall_score=score,
            is_poor_quality=is_poor_quality
        )

    except Exception as e:
        print(f"Error checking image quality: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error during quality check.")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
