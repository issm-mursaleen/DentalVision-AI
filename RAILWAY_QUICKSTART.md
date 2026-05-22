# Railway Deployment Quick Start

Get your Digital Eye app running on Railway in 5 minutes.

## 1. Prepare Your Project

```bash
# Ensure all files are committed
git add .
git commit -m "Prepare for Railway deployment"
git push
```

## 2. Connect to Railway

**Option A: Using Railway Dashboard** (Easiest)
1. Go to https://railway.app
2. Create new account or login
3. Click "New Project" → "Deploy from GitHub"
4. Authorize GitHub access
5. Select your repository

**Option B: Using Railway CLI**
```bash
npm install -g @railway/cli
railway login
railway init
```

## 3. Configure Backend Service

In Railway Dashboard:
1. Click "New Service" → "Docker"
2. Set these variables:

```
SUPABASE_URL=https://your-project-id.supabase.co/
SUPABASE_SERVICE_ROLE_KEY=your-actual-key-here
MAX_FILE_SIZE_MB=10
PYTHONUNBUFFERED=1
```

3. Under Settings:
   - **Dockerfile**: `Dockerfile.railway`
   - **Start Command**: `uvicorn backends.oral.app:app --host 0.0.0.0 --port $PORT`

4. Click "Deploy"

## 4. Configure Frontend Service

In Railway Dashboard:
1. Click "New Service" → "Docker"
2. Set these variables:

```
REACT_APP_API_URL=https://your-backend-railway-url.up.railway.app
NODE_ENV=production
```

3. Under Settings:
   - **Dockerfile**: `Dockerfile.frontend`

4. Click "Deploy"

## 5. Test Your Deployment

```bash
# Test backend
curl https://your-backend-url.up.railway.app/health

# Test frontend
Open https://your-frontend-url.up.railway.app in browser
```

## 6. Optional: Set Custom Domain

1. In service settings, click "Add Custom Domain"
2. Follow DNS setup instructions
3. Update `REACT_APP_API_URL` to use your domain

## Troubleshooting

### Models not found
- Verify `models/` folder exists with files
- Check Docker build logs: `railway logs -s backend`

### API not responding
- Check `/health` endpoint
- Verify `SUPABASE_URL` is optional (it's OK if not set)
- Check memory: Railway free tier has limited RAM

### Frontend can't reach backend
- Verify `REACT_APP_API_URL` is correct (include https://)
- Check backend is running: visit `/health`
- Check CORS settings in `backends/oral/app.py`

### Build fails
- Railway may be out of memory
- Upgrade plan or reduce image size
- Use `requirements-api.txt` instead of `requirements.txt`

## View Logs

```bash
railway logs -s backend --follow
railway logs -s frontend --follow
```

## Deployment Complete! 🚀

Your app is now live. Start using:
1. Frontend: `https://your-frontend-url.up.railway.app`
2. API Docs: `https://your-backend-url.up.railway.app/docs`

## Next: Production Checklist

- [ ] Set Supabase credentials for prediction logging
- [ ] Update CORS allowed origins in backend
- [ ] Set up custom domain
- [ ] Configure alerting/monitoring
- [ ] Test with real patient images
- [ ] Document feature toggles
- [ ] Set up backup strategy

## Need More Help?

- Full guide: See `RAILWAY_DEPLOYMENT.md`
- Railway Docs: https://docs.railway.app
- API Documentation: `/docs` endpoint on your backend

---

Deployed with 💜 on Railway
