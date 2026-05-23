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
COPY models/ /app/models/
COPY .env.example /app/.env

# Resolve Git LFS pointer files if present by downloading raw binary weights from GitHub
RUN if [ -f /app/models/oral-binary.pkl ] && grep -q "version https://git-lfs" /app/models/oral-binary.pkl; then \
        echo "Downloading oral-binary.pkl from GitHub LFS..." && \
        curl -L -f -o /app/models/oral-binary.pkl https://media.githubusercontent.com/media/issm-mursaleen/DentalVision-AI/main/models/oral-binary.pkl; \
    fi && \
    if [ -f /app/models/oral-binary.pth ] && grep -q "version https://git-lfs" /app/models/oral-binary.pth; then \
        echo "Downloading oral-binary.pth from GitHub LFS..." && \
        curl -L -f -o /app/models/oral-binary.pth https://media.githubusercontent.com/media/issm-mursaleen/DentalVision-AI/main/models/oral-binary.pth; \
    fi

# Add application path to Python Path
ENV PYTHONPATH=/app

EXPOSE 8080

# Start server using the PORT environment variable injected by Railway (default to 8080)
CMD ["sh", "-c", "uvicorn backends.oral.app:app --host 0.0.0.0 --port ${PORT:-8080}"]
