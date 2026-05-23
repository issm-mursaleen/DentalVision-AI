FROM python:3.10-slim

WORKDIR /app

# Install system dependencies required by OpenCV and curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    libgl1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy required folders
COPY backends/oral/ /app/backends/oral/
COPY ml/ /app/ml/
COPY .env.example /app/.env

# Download model weights from GitHub LFS
# Railway's ZIP archive excludes LFS files entirely, so we always download them
# Added cache buster to force re-download: 2026-05-23
RUN echo "Cache buster: v2" && \
    mkdir -p /app/models && \
    echo "Downloading oral-binary.pkl..." && \
    curl -L -f -o /app/models/oral-binary.pkl https://media.githubusercontent.com/media/issm-mursaleen/DentalVision-AI/main/models/oral-binary.pkl && \
    echo "Downloading oral-binary.pth..." && \
    curl -L -f -o /app/models/oral-binary.pth https://media.githubusercontent.com/media/issm-mursaleen/DentalVision-AI/main/models/oral-binary.pth && \
    echo "Downloading oral-disease.pkl..." && \
    curl -L -f -o /app/models/oral-disease.pkl https://media.githubusercontent.com/media/issm-mursaleen/DentalVision-AI/main/models/oral-disease.pkl && \
    echo "Downloading oral-disease.pth..." && \
    curl -L -f -o /app/models/oral-disease.pth https://media.githubusercontent.com/media/issm-mursaleen/DentalVision-AI/main/models/oral-disease.pth && \
    echo "All oral models downloaded successfully." && \
    ls -lh /app/models/

# Add application path to Python Path
ENV PYTHONPATH=/app

EXPOSE 8080

# Start server using the PORT environment variable injected by Railway (default to 8080)
CMD ["sh", "-c", "uvicorn backends.oral.app:app --host 0.0.0.0 --port ${PORT:-8080}"]
