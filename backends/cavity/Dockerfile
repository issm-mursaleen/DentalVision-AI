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
COPY backends/cavity/ /app/backends/cavity/
COPY models/ /app/models/
COPY .env.example /app/.env

# Resolve Git LFS pointer files if present by downloading raw binary weights from GitHub
RUN if [ -f /app/models/cavity.pt ] && grep -q "version https://git-lfs" /app/models/cavity.pt; then \
        echo "Downloading cavity.pt from GitHub LFS..." && \
        curl -L -f -o /app/models/cavity.pt https://media.githubusercontent.com/media/issm-mursaleen/DentalVision-AI/main/models/cavity.pt; \
    fi

# Add application path to Python Path
ENV PYTHONPATH=/app

EXPOSE 8080

# Start server using the PORT environment variable injected by Railway (default to 8080)
CMD ["sh", "-c", "uvicorn backends.cavity.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
