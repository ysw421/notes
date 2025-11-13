#!/bin/bash

echo "Starting local development servers..."
echo ""

trap 'kill $(jobs -p) 2>/dev/null' EXIT

echo "🚀 Starting Vercel dev server (port 3000)..."
vercel dev &
VERCEL_PID=$!

echo "⚡ Starting Wrangler dev server (port 8787)..."
wrangler dev &
WRANGLER_PID=$!

echo ""
echo "✅ Both servers are starting..."
echo "   - Frontend: http://localhost:3000"
echo "   - Worker API: http://localhost:8787"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

wait
