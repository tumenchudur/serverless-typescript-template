#!/bin/bash
set -e

STAGE=${1:-prod}
STACK=${2:-all}

echo "========================================="
echo "Serverless Deployment Script"
echo "========================================="
echo "Stage: $STAGE"
echo "Stack: $STACK"
echo "========================================="

# Build all packages first
echo ""
echo "Building all packages..."
pnpm run build

# Deploy function
deploy_stack() {
  local stack=$1
  echo ""
  echo "Deploying $stack to $STAGE..."
  cd "stacks/$stack"
  serverless deploy --stage "$STAGE" --verbose
  cd ../..
  echo "$stack deployed successfully!"
}

# Deploy based on STACK parameter
if [ "$STACK" = "all" ]; then
  echo ""
  echo "Deploying all stacks..."

  for dir in stacks/*/; do
    stack=$(basename "$dir")
    deploy_stack "$stack"
  done

  echo ""
  echo "========================================="
  echo "All stacks deployed successfully!"
  echo "========================================="
else
  if [ ! -d "stacks/$STACK" ]; then
    echo "Error: Stack '$STACK' not found in stacks/ directory"
    exit 1
  fi

  deploy_stack "$STACK"

  echo ""
  echo "========================================="
  echo "Deployment completed!"
  echo "========================================="
fi
