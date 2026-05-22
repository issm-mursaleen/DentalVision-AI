# 🚀 Deploy to Railway - Quick Guide

Your Digital Eye project is ready for Railway deployment!

## 30-Second Summary

This project has been configured with:
- ✅ Dockerfiles for both backend (FastAPI) and frontend (React)
- ✅ Railway configuration (`railway.json`)
- ✅ Optimized Docker images with production dependencies
- ✅ Docker-compose for local testing
- ✅ Deployment guides and verification scripts

## 3 Steps to Deploy

### 1️⃣ Verify & Commit

```powershell
# Windows - Verify everything is ready
.\verify-deployment.ps1

# Linux/Mac - Verify everything is ready  
bash verify-deployment.sh
```

If all checks pass, commit your changes:
```bash
git add .
git commit -m "fix: prepare for Railway deployment"
git push
```

### 2️⃣ Deploy on Railway

Go to https://railway.app and:
1. Click "New Project" → "Deploy from GitHub"
2. Select your repository
3. Railway will auto-detect `railway.json` and create services
4. Set environment variables (see below)
5. Click "Deploy"

### 3️⃣ Set Environment Variables

**Backend Service:**
```
MAX_FILE_SIZE_MB=10
PYTHONUNBUFFERED=1
SUPABASE_URL=<your-url-if-you-have-it>
SUPABASE_SERVICE_ROLE_KEY=<your-key-if-you-have-it>
```

**Frontend Service:**
```
REACT_APP_API_URL=https://your-backend-railway-url.up.railway.app
NODE_ENV=production
```

That's it! Your app will be live in 5-10 minutes.

## 🧪 Test Locally First (Optional)

```bash
# Start both services
docker-compose up

# Test backend
curl http://localhost:8080/health

# Test frontend
open http://localhost:3000
```

## 📚 Full Guides

- **`RAILWAY_QUICKSTART.md`** — Detailed 5-minute guide
- **`RAILWAY_DEPLOYMENT.md`** — Complete reference with options
- **`DEPLOYMENT_SUMMARY.md`** — Overview and checklist

## ❓ Common Questions

**Q: Do I need to set Supabase credentials?**
A: No, it's optional. The API works without it (predictions just won't be logged).

**Q: Can I use a custom domain?**
A: Yes! Railway supports custom domains in the service settings.

**Q: What if the build fails?**
A: Usually memory limit on free tier. Check `RAILWAY_DEPLOYMENT.md` for solutions.

**Q: How do I view logs?**
A: In Railway dashboard, click on service and view the logs tab.

## 🔗 Useful Links

- [Railway Docs](https://docs.railway.app)
- [Your Backend API](https://your-url.up.railway.app/docs) (once deployed)
- [Railway Dashboard](https://railway.app)

## ✅ Ready?

1. Run verification script
2. Push to GitHub
3. Deploy on Railway
4. Done! 🎉

Questions? See the full guides or Railway documentation.

---

**Status**: ✅ Ready to deploy
**Last Updated**: 2024
