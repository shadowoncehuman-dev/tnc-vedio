#!/usr/bin/env bash
set -e

# Use npx to run pnpm — avoids any global/system-level install
# npx caches to ~/.npm/_npx which is always writable
npx --yes pnpm@10 install --frozen-lockfile
PORT=10000 BASE_PATH=/ npx --yes pnpm@10 --filter @workspace/tnc-web run build
npx --yes pnpm@10 --filter @workspace/api-server run build
