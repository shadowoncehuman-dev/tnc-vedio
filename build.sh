#!/usr/bin/env bash
set -e

# Install pnpm locally (avoids read-only /usr/bin and /usr/lib on Render)
npm install --no-save pnpm@10

# Use the local pnpm binary for everything
PNPM="./node_modules/.bin/pnpm"

$PNPM install --frozen-lockfile
PORT=10000 BASE_PATH=/ $PNPM --filter @workspace/tnc-web run build
$PNPM --filter @workspace/api-server run build
