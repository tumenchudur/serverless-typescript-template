#!/bin/bash

# ===========================================
# Pre-Deployment Validation Script
# ===========================================
# Run this before deploying to catch common issues
# Usage: ./scripts/pre-deploy.sh [stage]
# Example: ./scripts/pre-deploy.sh prod

set -e

STAGE=${1:-dev}
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Pre-Deployment Validation for: $STAGE"
echo "=========================================="
echo ""

ERRORS=0
WARNINGS=0

# Helper functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ERRORS=$((ERRORS + 1))
}

check_warn() {
    echo -e "${YELLOW}!${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

# ===========================================
# 1. Check Node.js version
# ===========================================
echo "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 22 ]; then
    check_pass "Node.js version: $(node -v)"
else
    check_fail "Node.js version must be >= 22.x (current: $(node -v))"
fi

# ===========================================
# 2. Check pnpm is installed
# ===========================================
echo "Checking pnpm..."
if command -v pnpm &> /dev/null; then
    check_pass "pnpm installed: $(pnpm -v)"
else
    check_fail "pnpm is not installed"
fi

# ===========================================
# 3. Check AWS credentials
# ===========================================
echo "Checking AWS credentials..."
if aws sts get-caller-identity &> /dev/null; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    check_pass "AWS credentials valid (Account: $ACCOUNT_ID)"
else
    check_fail "AWS credentials not configured or invalid"
fi

# ===========================================
# 4. Check Serverless Framework
# ===========================================
echo "Checking Serverless Framework..."
if command -v serverless &> /dev/null; then
    check_pass "Serverless installed: $(serverless -v)"
else
    check_warn "Serverless Framework not installed globally (will use npx)"
fi

# ===========================================
# 5. Check required SSM parameters (for prod/staging)
# ===========================================
if [ "$STAGE" = "prod" ] || [ "$STAGE" = "staging" ]; then
    echo "Checking SSM parameters for $STAGE..."

    SSM_PARAMS=(
        "/$STAGE/app/database-url"
        "/$STAGE/app/security-group-id"
        "/$STAGE/app/subnet-1"
        "/$STAGE/app/subnet-2"
    )

    for param in "${SSM_PARAMS[@]}"; do
        if aws ssm get-parameter --name "$param" &> /dev/null; then
            check_pass "SSM parameter exists: $param"
        else
            check_fail "SSM parameter missing: $param"
        fi
    done
else
    echo "Skipping SSM checks for dev stage..."
    check_pass "SSM checks skipped for dev"
fi

# ===========================================
# 6. Run TypeScript type check
# ===========================================
echo "Running TypeScript type check..."
if pnpm run type-check > /dev/null 2>&1; then
    check_pass "TypeScript type check passed"
else
    check_fail "TypeScript type check failed"
fi

# ===========================================
# 7. Run linter
# ===========================================
echo "Running linter..."
if pnpm run lint > /dev/null 2>&1; then
    check_pass "Linter passed"
else
    check_warn "Linter has warnings (check manually)"
fi

# ===========================================
# 8. Check for uncommitted changes
# ===========================================
echo "Checking for uncommitted changes..."
if [ -z "$(git status --porcelain)" ]; then
    check_pass "No uncommitted changes"
else
    if [ "$STAGE" = "prod" ]; then
        check_fail "Uncommitted changes detected (not allowed for prod)"
    else
        check_warn "Uncommitted changes detected"
    fi
fi

# ===========================================
# 9. Check current branch (for prod)
# ===========================================
if [ "$STAGE" = "prod" ]; then
    echo "Checking branch for production..."
    CURRENT_BRANCH=$(git branch --show-current)
    if [ "$CURRENT_BRANCH" = "main" ]; then
        check_pass "On main branch"
    else
        check_fail "Production deploys must be from main branch (current: $CURRENT_BRANCH)"
    fi
fi

# ===========================================
# 10. Check dependencies are installed
# ===========================================
echo "Checking dependencies..."
if [ -d "node_modules" ]; then
    check_pass "Dependencies installed"
else
    check_fail "Dependencies not installed (run: pnpm install)"
fi

# ===========================================
# Summary
# ===========================================
echo ""
echo "=========================================="
echo "Validation Summary"
echo "=========================================="

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}FAILED${NC}: $ERRORS error(s), $WARNINGS warning(s)"
    echo ""
    echo "Please fix the errors above before deploying."
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}PASSED WITH WARNINGS${NC}: $WARNINGS warning(s)"
    echo ""
    echo "You can proceed with deployment, but review the warnings."
    exit 0
else
    echo -e "${GREEN}PASSED${NC}: All checks passed!"
    echo ""
    echo "Ready to deploy to $STAGE"
    exit 0
fi
