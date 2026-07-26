#!/bin/bash

trap 'kill $(jobs -p) 2>/dev/null' EXIT

echo "Static site  -> http://localhost:3000/db/"
python3 -m http.server 3000 --bind 127.0.0.1 >/dev/null 2>&1 &

echo "Worker API   -> http://localhost:8787"
npx wrangler dev

wait
