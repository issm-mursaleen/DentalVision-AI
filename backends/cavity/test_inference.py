import requests

r = requests.post(
    'http://127.0.0.1:8000/api/detect_cavity',
    files={'file': ('test.jpg', open(r'c:\Users\hp\Desktop\DentalVisionAI\cavity_dataset\test\images\d2_0950.jpg', 'rb'), 'image/jpeg')}
)

d = r.json()
print(f"Status: {r.status_code}")
print(f"Cavities: {d['cavity_count']}")
print(f"Confidence: {d['confidence_score']}")
print(f"Message: {d['message']}")
print(f"Annotated b64 len: {len(d['annotated_image_base64'])}")
print(f"Heatmap b64 len: {len(d['heatmap_image_base64'])}")
