#!/usr/bin/env bash
set -e

# Use npx to run pnpm — avoids any global/system-level install
# npx caches to ~/.npm/_npx which is always writable
npx --yes pnpm@10 install --frozen-lockfile

# Push DB schema to create/update tables (safe to run on every deploy)
# Continues even if DATABASE_URL is not set or push fails
npx --yes pnpm@10 --filter @workspace/db run push || echo "Warning: DB schema push skipped or failed"

PORT=10000 BASE_PATH=/ npx --yes pnpm@10 --filter @workspace/tnc-web run build
npx --yes pnpm@10 --filter @workspace/api-server run build
