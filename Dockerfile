FROM node:18

WORKDIR /app

# Copy all files from current directory
COPY . .

# Install dependencies
RUN npm install --production 2>/dev/null || npm install

# Create logs directory
RUN mkdir -p /app/logs

# Verify node and npm are available
RUN which node && which npm && node --version

# Verify files are present
RUN test -f /app/lib/database.js || (echo "ERROR: lib/database.js not found" && false)
RUN test -f /app/agents/order-execution-agent/index.js || (echo "ERROR: agents/order-execution-agent/index.js not found" && false)

# Start application using full path to node
ENTRYPOINT ["/usr/local/bin/node", "index.js"]
