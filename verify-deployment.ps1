# Verification script for Railway deployment (Windows)
# Run this before pushing to Railway

Write-Host "🔍 Digital Eye — Deployment Verification" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$FAILED = 0

# Check 1: Required directories
Write-Host "✓ Checking required directories..." -ForegroundColor Cyan
$RequiredDirs = @("ml", "backends/oral", "models", "app/src")
foreach ($dir in $RequiredDirs) {
    if (Test-Path $dir) {
        Write-Host "  ✓ $dir exists" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $dir NOT found" -ForegroundColor Red
        $FAILED++
    }
}
Write-Host ""

# Check 2: Required files
Write-Host "✓ Checking required files..." -ForegroundColor Cyan
$RequiredFiles = @(
    "backends/oral/app.py",
    "ml/model.py",
    "requirements-api.txt",
    "Dockerfile.railway",
    "Dockerfile.frontend",
    "railway.json",
    "docker-compose.yml"
)
foreach ($file in $RequiredFiles) {
    if (Test-Path $file) {
        Write-Host "  ✓ $file exists" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $file NOT found" -ForegroundColor Red
        $FAILED++
    }
}
Write-Host ""

# Check 3: Model files
Write-Host "✓ Checking model files..." -ForegroundColor Cyan
$ModelFiles = @(
    "models/oral-binary.pkl",
    "models/oral-binary.pth",
    "models/oral-disease.pkl",
    "models/oral-disease.pth"
)
foreach ($file in $ModelFiles) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length / 1MB
        Write-Host "  ✓ $file ($([Math]::Round($size, 1))MB)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $file NOT found" -ForegroundColor Red
        $FAILED++
    }
}
$totalSize = (Get-ChildItem -Path "models/" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "  Total models size: $([Math]::Round($totalSize, 1))MB"
Write-Host ""

# Check 4: Environment setup
Write-Host "✓ Checking environment configuration..." -ForegroundColor Cyan
if (Test-Path ".env.example") {
    Write-Host "  ✓ .env.example exists" -ForegroundColor Green
} else {
    Write-Host "  ⚠  .env.example NOT found (but not critical)" -ForegroundColor Yellow
}
if (Test-Path ".env.production") {
    Write-Host "  ✓ .env.production exists" -ForegroundColor Green
} else {
    Write-Host "  ⚠  .env.production NOT found" -ForegroundColor Yellow
}
Write-Host ""

# Check 5: Git status
Write-Host "✓ Checking git status..." -ForegroundColor Cyan
try {
    $gitStatus = & git status --porcelain 2>&1
    if ($LASTEXITCODE -eq 0) {
        $uncommitted = @($gitStatus | Where-Object { $_ }).Count
        if ($uncommitted -eq 0) {
            Write-Host "  ✓ All changes committed" -ForegroundColor Green
        } else {
            Write-Host "  ⚠  $uncommitted uncommitted changes" -ForegroundColor Yellow
            Write-Host "    Tip: Run `git add . && git commit -m 'fix: prepare for deployment'`" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "  ✗ Not a git repository" -ForegroundColor Red
    $FAILED++
}
Write-Host ""

# Check 6: Docker availability
Write-Host "✓ Checking Docker..." -ForegroundColor Cyan
if (Get-Command docker -ErrorAction SilentlyContinue) {
    $dockerVersion = docker --version
    Write-Host "  ✓ Docker installed: $dockerVersion" -ForegroundColor Green
} else {
    Write-Host "  ⚠  Docker not installed (needed for local testing)" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "=========================================" -ForegroundColor Cyan
if ($FAILED -eq 0) {
    Write-Host "✅ All checks passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "1. Review RAILWAY_QUICKSTART.md"
    Write-Host "2. Push to GitHub: git push"
    Write-Host "3. Deploy on Railway: railway init && railway add"
    Write-Host ""
    exit 0
} else {
    Write-Host "❌ $FAILED checks failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please fix the issues above before deploying."
    Write-Host ""
    exit 1
}
