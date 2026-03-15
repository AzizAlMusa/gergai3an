#!/usr/bin/env bash
set -e

echo "==> Installing client dependencies..."
cd client
npm install

echo "==> Building client..."
node node_modules/vite/bin/vite.js build

echo "==> Installing server dependencies..."
cd ../server
npm install

echo "==> Build complete!"
