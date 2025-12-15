#!/bin/bash
# Deploy frontend to VPS
# Run this after npm run ui:build to copy dist to the web root

set -e

DIST_DIR="/opt/nullify-app/dist"
WEB_ROOT="/var/www/nullify-app"

echo "[deploy] Copying build from $DIST_DIR to $WEB_ROOT..."

# Clear old files
sudo rm -rf "$WEB_ROOT"/*

# Copy new build
sudo cp -r "$DIST_DIR"/* "$WEB_ROOT"/

# Verify
BUNDLE=$(cat "$WEB_ROOT/index.html" | grep -o 'index-[^"]*\.js')
echo "[deploy] Deployed bundle: $BUNDLE"
echo "[deploy] Done!"
