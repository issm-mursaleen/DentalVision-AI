# Digital Eye — Railway Deployment Guide

This guide walks you through deploying the Digital Eye Oral Cancer Detection system to Railway.

## Prerequisites

- A [Railway](https://railway.app) account
- Railway CLI installed: `npm install -g @railway/cli`
- Git repository initialized and committed
- All model files in `models/` directory

## Architecture

The project consists of two main services:

1. **Backend API** (`backends/oral/app.py`)
   - FastAPI server providing `/predict` and `/health` endpoints
   - Loads ML models from `models/` directory
   - Handles image uploads and inference
   - Optional Supabase integration for logging

2. **Frontend** (`app/` folder)
   - React + Vite application
   - Communicates with backend API
   - Displays predictions and Grad-CAM visualizations

## Deployment Options

### Option 1: Separate Services (Recommended)

Deploy backend and frontend as two independent Railway services.

#### Step 1: Create Railway Project

```bash
railway init
```

Follow the prompts to create a new Railway project.

#### Step 2: Deploy Backend

```bash
# Add backend service
railway add

# Choose "Docker" as the template
# Point to Dockerfile.railway when prompted
```

Or manually create the backend service:

1. Go to [Railway Dashboard](https://railway.app)
2. Click "New Project" → "Deploy from GitHub"
3. Select your repository
4. In "Environment", set these variables:
   ```
   SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-key
   MAX_FILE_SIZE_MB=10
   PYTHONUNBUFFERED=1
   ```
5. In "Settings", set:
   - **Dockerfile**: `Dockerfile.railway`
   - **Start Command**: `uvicorn backends.oral.app:app --host 0.0.0.0 --port $PORT`

#### Step 3: Deploy Frontend

1. Click "New Service" → "Docker"
2. Configure:
   - **Dockerfile**: `Dockerfile.frontend`
   - **Environment Variables**:
     ```
     REACT_APP_API_URL=https://your-backend-railway-url.up.railway.app
     NODE_ENV=production
     ```

3. The frontend will be available at `https://your-frontend-railway-url.up.railway.app`

#### Step 4: Configure CORS in Backend

The backend already has open CORS for local development. For production, update `backends/oral/app.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://your-frontend-railway-url.up.railway.app",
        "https://yourdomain.com"  # If you have a custom domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Option 2: Monolith Deployment

Deploy backend and frontend from a single Docker container.

Create `Dockerfile.monolith`:

```dockerfile
# Build frontend
FROM node:20-alpine AS frontend_build
WORKDIR /app
COPY app/package*.json ./
RUN npm ci --legacy-peer-deps
COPY app/src ./src
COPY app/public ./public
COPY app/index.html ./
COPY app/vite.config.js ./
COPY app/tailwind.config.js ./
COPY app/postcss.config.js* ./
RUN npm run build

# Build backend
FROM python:3.10-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libsm6 libxext6 libxrender1 libgomp1 && \
    rm -rf /var/lib/apt/lists/*

COPY requirements-api.txt .
RUN pip install --no-cache-dir -r requirements-api.txt

COPY ml/ ./ml/
COPY backends/ ./backends/
COPY models/ ./models/
COPY --from=frontend_build /app/dist ./static

ENV PYTHONUNBUFFERED=1
EXPOSE 8080
CMD ["uvicorn", "backends.oral.app:app", "--host", "0.0.0.0", "--port", "8080"]
```

Then deploy with `Dockerfile.monolith` using the same process as the backend above.

## Environment Variables

Required environment variables (set in Railway dashboard):

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | No | Supabase project URL (for prediction logging) |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Supabase service role key |
| `MAX_FILE_SIZE_MB` | No | Max upload size (default: 10) |
| `REACT_APP_API_URL` | Yes (frontend) | Backend API URL |
| `PYTHONUNBUFFERED` | No | Set to 1 for unbuffered output |

## Model Files

The models are large (~150MB total). They're included in the Docker image via the `COPY models/ ./models/` command.

If you need to update models without rebuilding:
1. Upload to Railway's storage or S3
2. Modify the backend to download on startup
3. Update model paths in environment variables

## Troubleshooting

### Build Fails with Out of Memory

Railway's free tier has limited memory. Solutions:
1. Upgrade to a paid plan
2. Use a smaller model (ResNet18 instead of ResNet50)
3. Convert model to ONNX for smaller file size

### Model Files Not Found

Ensure `models/` directory contains:
- `oral-binary.pkl`
- `oral-binary.pth`
- `oral-disease.pkl`
- `oral-disease.pth`

Check with:
```bash
ls -la models/
```

### CORS Errors

Update the CORS allowlist in `backends/oral/app.py` to match your frontend URL.

### API Returns 500 Errors

Check Railway logs:
```bash
railway logs -s backend
```

Common issues:
- Missing environment variables
- Model files not found
- Insufficient memory for inference

### Frontend Can't Connect to Backend

1. Verify backend service is running: Visit `/health` endpoint
2. Check `REACT_APP_API_URL` is correct (must include protocol)
3. Ensure CORS is properly configured

## Health Checks

The backend exposes a `/health` endpoint that returns:

```json
{
  "status": "ok",
  "device": "cpu",
  "binary": {
    "loaded": true,
    "model_name": "ResNet18_weighted_scratch",
    "class_names": ["Normal", "Abnormal"]
  },
  "disease": {
    "loaded": true,
    "model_name": "ResNet18_mod1_weighted_dp(0.5)",
    "class_names": ["Variation", "OPMD", "Oral Cancer"]
  }
}
```

## Monitoring

### Check Backend Status

```bash
railway logs -s backend --follow
```

### Check Frontend Status

```bash
railway logs -s frontend --follow
```

### View Service Metrics

In Railway dashboard under each service:
- CPU/Memory usage
- Network stats
- Log output

## Scaling

### Horizontal Scaling

In Railway dashboard:
1. Go to service settings
2. Increase "Replicas" to run multiple instances
3. Railway automatically load-balances

### Vertical Scaling

Upgrade your Railway plan for more resources per replica.

## Custom Domain

1. In Railway dashboard → Service Settings
2. Add custom domain
3. Update DNS records as instructed
4. Update `REACT_APP_API_URL` and CORS settings

## Cost Optimization

1. Use shared PostgreSQL (if needed) instead of standalone
2. Set replica count to 1 for low-traffic testing
3. Use CPU/memory alarms to scale automatically
4. Archive old prediction logs periodically

## CI/CD Integration

Railway auto-deploys on Git push. To customize:

1. Create `railway.yaml` or use dashboard triggers
2. Set deployment rules (branch, environment)
3. Configure pre/post-deployment hooks

## Rollback

If a deployment breaks:

```bash
railway rollback
```

Select the previous deployment to revert.

## Next Steps

1. **Local Testing**: `docker build -f Dockerfile.railway -t digital-eye .`
2. **Push to GitHub**: Ensure your repo is on GitHub
3. **Connect Railway**: Link your GitHub account
4. **Set Variables**: Configure environment variables
5. **Deploy**: Push to trigger auto-deployment
6. **Monitor**: Watch logs for any issues

## Support

For Railway-specific issues:
- [Railway Docs](https://docs.railway.app)
- [Railway Community](https://discord.gg/railway)

For Digital Eye issues:
- Check logs in Railway dashboard
- Verify model files exist
- Test locally with `docker build`

## Example Deployment

```bash
# 1. Local testing
docker build -f Dockerfile.railway -t digital-eye-api .
docker run -p 8080:8080 -e MAX_FILE_SIZE_MB=10 digital-eye-api

# 2. Push to GitHub
git add .
git commit -m "Prepare for Railway deployment"
git push

# 3. In Railway dashboard
# - Create new project
# - Connect GitHub repo
# - Set environment variables
# - Deploy!

# 4. Verify
curl https://your-backend.up.railway.app/health
```

---

Last updated: 2024
