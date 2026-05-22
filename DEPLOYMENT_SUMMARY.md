# Digital Eye — Deployment Ready ✅

Your project has been configured for Railway deployment. Here's what's been set up:

## 📋 What's New

### Docker Configuration
- ✅ `Dockerfile.railway` — Optimized backend image
- ✅ `Dockerfile.frontend` — Optimized frontend image
- ✅ `docker-compose.yml` — Local testing environment
- ✅ `.dockerignore` — Excludes unnecessary files (~500MB savings)

### Dependencies
- ✅ `requirements-api.txt` — Production-only dependencies (much smaller than requirements.txt)
- ✅ Original `requirements.txt` unchanged (still useful for local development)

### Railway Configuration
- ✅ `railway.json` — Railway project configuration
- ✅ `.env.production` — Production environment template
- ✅ `.env.example` — Fallback environment variables

### Documentation
- ✅ `RAILWAY_QUICKSTART.md` — Quick 5-minute setup guide
- ✅ `RAILWAY_DEPLOYMENT.md` — Comprehensive deployment guide
- ✅ `verify-deployment.sh` / `verify-deployment.ps1` — Pre-deployment checklist

## 🚀 Quick Start (5 minutes)

### Step 1: Verify Everything is Ready

**On Windows (PowerShell):**
```powershell
.\verify-deployment.ps1
```

**On Mac/Linux:**
```bash
bash verify-deployment.sh
```

### Step 2: Push to GitHub

```bash
git add .
git commit -m "fix: prepare for Railway deployment"
git push
```

### Step 3: Deploy

1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub"
3. Select your repository
4. Railway will automatically detect the `railway.json`
5. Set environment variables (see below)
6. Click "Deploy"

### Step 4: Configure Environment Variables

In Railway Dashboard, set these for the **backend** service:

```
MAX_FILE_SIZE_MB=10
PYTHONUNBUFFERED=1

# Optional - for Supabase prediction logging
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

For the **frontend** service:
```
REACT_APP_API_URL=https://your-backend-railway-url.up.railway.app
NODE_ENV=production
```

### Step 5: Test

```bash
# Check backend is running
curl https://your-backend-url.up.railway.app/health

# Open frontend in browser
https://your-frontend-url.up.railway.app
```

## 📁 File Structure

```
project/
├── Dockerfile.railway          # Backend container
├── Dockerfile.frontend         # Frontend container
├── railway.json               # Railway config
├── docker-compose.yml         # Local testing
├── .dockerignore              # Optimize image size
├── requirements-api.txt       # Production dependencies (slim)
├── .env.production            # Production env template
├── backends/
│   └── oral/
│       └── app.py            # FastAPI application
├── ml/
│   ├── model.py              # Model architecture
│   └── ...
├── models/
│   ├── oral-binary.pkl       # Binary classifier
│   ├── oral-binary.pth       # Binary weights
│   ├── oral-disease.pkl      # Disease classifier
│   └── oral-disease.pth      # Disease weights
├── app/
│   ├── src/                  # React frontend
│   ├── package.json
│   └── vite.config.js
├── RAILWAY_QUICKSTART.md     # 5-min guide
├── RAILWAY_DEPLOYMENT.md     # Full guide
└── verify-deployment.sh      # Pre-deployment checklist
```

## 🔍 Verification Checklist

Before deploying, ensure:

- [ ] All commits are pushed to GitHub
- [ ] `models/` folder contains all 4 model files (~150MB total)
- [ ] `verify-deployment.ps1` or `.sh` passes all checks
- [ ] Docker is installed (for local testing)
- [ ] Node modules are in `.gitignore` (to keep repo small)

Run the verification script:

```powershell
# Windows
.\verify-deployment.ps1

# Linux/Mac
bash verify-deployment.sh
```

## 🐳 Local Testing

Test everything locally before deploying to Railway:

```bash
# Build and run both services
docker-compose up

# Check backend
curl http://localhost:8080/health

# Check frontend
Open http://localhost:3000 in browser

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop services
docker-compose down
```

## 📊 Image Sizes

| Dockerfile | Size | Notes |
|-----------|------|-------|
| `Dockerfile.railway` (backend) | ~1.5GB | PyTorch + models |
| `Dockerfile.frontend` | ~200MB | Node + React build |

**Optimization applied:**
- Using `requirements-api.txt` instead of `requirements.txt` saves ~300MB
- `.dockerignore` excludes unnecessary files
- Multi-stage build for frontend reduces final size

## ⚠️ Common Issues

### Build fails with "out of memory"
Railway's free tier has limited memory. Solutions:
1. Upgrade to Starter plan ($5/month)
2. Use Railway's Docker builder (it's cached)
3. Check Docker logs: `railway logs -s backend`

### Models not found
```
FileNotFoundError: models/oral-binary.pkl
```
Solution: Ensure `models/` directory is committed to git and copied in Dockerfile.

### API not responding
```
curl: (7) Failed to connect to backend
```
Solution:
1. Check backend service status in Railway
2. Visit `/health` endpoint directly
3. Check logs: `railway logs -s backend`

### Frontend can't reach backend
```
Error: Failed to fetch from API
```
Solution:
1. Check `REACT_APP_API_URL` is set correctly
2. Ensure backend URL uses `https://`
3. Check CORS configuration in `backends/oral/app.py`

## 📈 Monitoring

In Railway Dashboard:

1. **Backend Service:**
   - Memory usage (models take ~300MB)
   - CPU usage during inference
   - Logs for errors/warnings
   - Request metrics

2. **Frontend Service:**
   - Memory usage
   - Response times
   - Logs for deployment issues

3. **Health Checks:**
   - Backend: `/health` endpoint
   - Frontend: responds to requests

## 🔐 Security

### .env Files
- ✅ `.env` (with real secrets) is in `.gitignore`
- ✅ `.env.example` shows template
- ✅ `.env.production` is safe to commit
- ✅ Set actual secrets in Railway dashboard

### Credentials
- Never commit `.env` with real values
- Use Railway's environment variable interface
- Supabase keys are optional (prediction logging disabled if not set)

## 💾 Backing Up Models

Models are large (~150MB). To keep them:

**Option 1: Commit to Git (Recommended)**
- Already done — models are in the repo
- Railway downloads them with Docker build

**Option 2: External Storage**
- For large-scale deployments, store in:
  - S3 / Cloud Storage
  - Model registry (HuggingFace, etc.)
  - Download on startup

## 📞 Support

### Before Contacting Support

1. Run verification script: `verify-deployment.ps1` or `.sh`
2. Check logs: `railway logs -s backend`
3. Test locally: `docker-compose up`
4. Review `RAILWAY_DEPLOYMENT.md`

### Getting Help

- **Railway Docs**: https://docs.railway.app
- **Railway Community**: https://discord.gg/railway
- **Project Issues**: Check backend logs and health endpoint

## ✅ Pre-Deployment Checklist

- [ ] Ran verification script successfully
- [ ] All code committed to git
- [ ] Models in `models/` folder (4 files, ~150MB)
- [ ] GitHub account connected to Railway
- [ ] Reviewed `RAILWAY_QUICKSTART.md`
- [ ] Prepared Supabase credentials (optional)
- [ ] Tested locally with `docker-compose up`
- [ ] Backend `/health` returns 200 status
- [ ] Frontend loads in browser at `localhost:3000`

## 🎯 Next Steps

1. **Verify**: Run `verify-deployment.ps1` or `.sh`
2. **Test Locally**: `docker-compose up`
3. **Commit & Push**: `git push`
4. **Deploy**: Open Railway dashboard
5. **Configure**: Set environment variables
6. **Monitor**: Check logs and health status

## 📚 Documentation

- `RAILWAY_QUICKSTART.md` — 5-minute setup guide (start here!)
- `RAILWAY_DEPLOYMENT.md` — Complete reference guide
- This file — Overview and checklist

---

**Last Updated**: 2024
**Railway Ready**: ✅ Yes
**Status**: Ready to deploy

**Questions?** Check the guides or Railway documentation.
