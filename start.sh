#!/bin/bash
# Start Node.js server in background
node server.js &
NODE_PID=$!

# Start Caddy in foreground with config
caddy run --config Caddyfile

# If Caddy exits, kill Node.js
kill $NODE_PID 2>/dev/null
