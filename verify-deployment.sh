#!/bin/bash

# Verification script for Railway deployment
# Run this before pushing to Railway

set -e

echo "🔍 Digital Eye — Deployment Verification"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED=0

# Check 1: Required directories
echo "✓ Checking required directories..."
REQUIRED_DIRS=("ml" "backends/oral" "models" "app/src")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "  ${GREEN}✓${NC} $dir exists"
    else
        echo "  ${RED}✗${NC} $dir NOT found"
        FAILED=$((FAILED + 1))
    fi
done
echo ""

# Check 2: Required files
echo "✓ Checking required files..."
REQUIRED_FILES=(
    "backends/oral/app.py"
    "ml/model.py"
    "requirements-api.txt"
    "Dockerfile.railway"
    "Dockerfile.frontend"
    "railway.json"
    "docker-compose.yml"
)
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ${GREEN}✓${NC} $file exists"
    else
        echo "  ${RED}✗${NC} $file NOT found"
        FAILED=$((FAILED + 1))
    fi
done
echo ""

# Check 3: Model files
echo "✓ Checking model files..."
MODEL_FILES=(
    "models/oral-binary.pkl"
    "models/oral-binary.pth"
    "models/oral-disease.pkl"
    "models/oral-disease.pth"
)
for file in "${MODEL_FILES[@]}"; do
    if [ -f "$file" ]; then
        SIZE=$(du -h "$file" | cut -f1)
        echo "  ${GREEN}✓${NC} $file ($SIZE)"
    else
        echo "  ${RED}✗${NC} $file NOT found"
        FAILED=$((FAILED + 1))
    fi
done
TOTAL_SIZE=$(du -sh models/ | cut -f1)
echo "  Total models size: $TOTAL_SIZE"
echo ""

# Check 4: Environment setup
echo "✓ Checking environment configuration..."
if [ -f ".env.example" ]; then
    echo "  ${GREEN}✓${NC} .env.example exists"
else
    echo "  ${YELLOW}⚠${NC}  .env.example NOT found (but not critical)"
fi
if [ -f ".env.production" ]; then
    echo "  ${GREEN}✓${NC} .env.production exists"
else
    echo "  ${YELLOW}⚠${NC}  .env.production NOT found"
fi
echo ""

# Check 5: Git status
echo "✓ Checking git status..."
if git rev-parse --git-dir > /dev/null 2>&1; then
    UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l)
    if [ "$UNCOMMITTED" -eq 0 ]; then
        echo "  ${GREEN}✓${NC} All changes committed"
    else
        echo "  ${YELLOW}⚠${NC}  $UNCOMMITTED uncommitted changes"
        echo "    ${YELLOW}Tip: Run${NC} git add . && git commit -m 'fix: prepare for deployment'"
    fi
else
    echo "  ${RED}✗${NC} Not a git repository"
    FAILED=$((FAILED + 1))
fi
echo ""

# Check 6: Docker availability
echo "✓ Checking Docker..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo "  ${GREEN}✓${NC} Docker installed: $DOCKER_VERSION"
else
    echo "  ${YELLOW}⚠${NC}  Docker not installed (needed for local testing)"
fi
echo ""

# Check 7: Validate Dockerfile syntax
echo "✓ Validating Dockerfiles..."
if command -v docker &> /dev/null; then
    if docker build --dry-run -f Dockerfile.railway . > /dev/null 2>&1; then
        echo "  ${GREEN}✓${NC} Dockerfile.railway is valid"
    else
        echo "  ${RED}✗${NC} Dockerfile.railway has syntax errors"
        FAILED=$((FAILED + 1))
    fi
    if docker build --dry-run -f Dockerfile.frontend . > /dev/null 2>&1; then
        echo "  ${GREEN}✓${NC} Dockerfile.frontend is valid"
    else
        echo "  ${RED}✗${NC} Dockerfile.frontend has syntax errors"
        FAILED=$((FAILED + 1))
    fi
else
    echo "  ${YELLOW}⚠${NC}  Skipping (Docker not installed)"
fi
echo ""

# Check 8: Python imports
echo "✓ Checking Python imports..."
if command -v python3 &> /dev/null; then
    # Check if basic imports work
    if python3 -c "import torch, fastapi, fastapi.middleware.cors, pytorch_grad_cam" 2>/dev/null; then
        echo "  ${GREEN}✓${NC} Core dependencies available"
    else
        echo "  ${YELLOW}⚠${NC}  Some dependencies not available locally (OK for Railway)"
    fi
else
    echo "  ${YELLOW}⚠${NC}  Python not available"
fi
echo ""

# Summary
echo "========================================="
if [ $FAILED -eq 0 ]; then
    echo "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review RAILWAY_QUICKSTART.md"
    echo "2. Push to GitHub: git push"
    echo "3. Deploy on Railway: railway init && railway add"
    echo ""
    exit 0
else
    echo "${RED}❌ $FAILED checks failed!${NC}"
    echo ""
    echo "Please fix the issues above before deploying."
    echo ""
    exit 1
fi
