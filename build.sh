#!/usr/bin/env bash
set -e

# Use npx to run pnpm — avoids any global/system-level install
# npx caches to ~/.npm/_npx which is always writable
npx --yes pnpm@10 install --frozen-lockfile

# Application data is stored in Supabase through server-side REST calls.
# Run docs/supabase-schema.sql once in the Supabase SQL Editor before deploy.

# Build both API server and web application for deployment
PORT=10000 BASE_PATH=/ npx --yes pnpm@10 --filter @workspace/tnc-web run build
npx --yes pnpm@10 --filter @workspace/api-server run build

# Copy the built web application to root-level public directory for Vercel
mkdir -p public
cp -r artifacts/tnc-web/dist/public/* public/
