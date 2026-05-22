FROM python:3.10-slim

WORKDIR /app

# Install system dependencies required by OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy required folders
COPY backends/oral/ /app/backends/oral/
COPY ml/ /app/ml/
COPY .env.example /app/.env

# Add application path to Python Path
ENV PYTHONPATH=/app

EXPOSE 8080

# Start server using the PORT environment variable injected by Railway (default to 8080)
CMD ["sh", "-c", "uvicorn backends.oral.app:app --host 0.0.0.0 --port ${PORT:-8080}"]
