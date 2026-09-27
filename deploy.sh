#!/bin/bash

# AUTOMATED RAILWAY DEPLOYMENT SCRIPT
# Run this once after organizing all files and it handles everything

set -e

echo "🚀 AUTONOMOUS TRADING AGENTS - AUTOMATED DEPLOYMENT"
echo "=================================================="
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Railway CLI is installed
echo "📦 Checking Railway CLI..."
if ! command -v railway &> /dev/null; then
    echo -e "${YELLOW}Railway CLI not found. Installing...${NC}"
    npm install -g @railway/cli
fi

# Check if logged in
echo "🔐 Checking Railway login..."
if ! railway whoami &> /dev/null; then
    echo -e "${YELLOW}Not logged in. Opening login...${NC}"
    railway login
fi

# Link to project
echo ""
echo "🔗 Linking to Railway project..."
railway link || true

# Add PostgreSQL if not already added
echo ""
echo "📊 Checking PostgreSQL..."
if ! railway service list | grep -i postgres &> /dev/null; then
    echo -e "${YELLOW}Adding PostgreSQL service...${NC}"
    railway add
else
    echo -e "${GREEN}✅ PostgreSQL already added${NC}"
fi

# Wait for PostgreSQL to initialize
echo ""
echo "⏳ Waiting for PostgreSQL to initialize..."
sleep 10

# Set all environment variables
echo ""
echo "🔑 Setting environment variables..."

railway variables set BINANCE_TESTNET_API_KEY "oibQy50SPkGO1WQLsNmO2jrqiHmbEJBlqURlXuh0OSCzvSwTc5okcyAa22STOPm" && \
echo -e "${GREEN}✅ BINANCE_TESTNET_API_KEY${NC}" || echo -e "${RED}❌ Failed${NC}"

railway variables set BINANCE_TESTNET_SECRET_KEY "eGpKKMoW8Oh7n5qmzfNRT9E6KG3a2EFqebCK88syRuhzObwA2BEMW5laTXtQ0ZSE" && \
echo -e "${GREEN}✅ BINANCE_TESTNET_SECRET_KEY${NC}" || echo -e "${RED}❌ Failed${NC}"

# Discord webhook - ask user for this
echo ""
echo -e "${YELLOW}Enter your Discord webhook URL (from DISCORD_SETUP_QUICK.md):${NC}"
read DISCORD_URL
railway variables set DISCORD_WEBHOOK_URL "$DISCORD_URL" && \
echo -e "${GREEN}✅ DISCORD_WEBHOOK_URL${NC}" || echo -e "${RED}❌ Failed${NC}"

railway variables set TRADING_MODE "TESTNET" && \
echo -e "${GREEN}✅ TRADING_MODE${NC}" || echo -e "${RED}❌ Failed${NC}"

railway variables set LOG_LEVEL "info" && \
echo -e "${GREEN}✅ LOG_LEVEL${NC}" || echo -e "${RED}❌ Failed${NC}"

railway variables set NODE_ENV "production" && \
echo -e "${GREEN}✅ NODE_ENV${NC}" || echo -e "${RED}❌ Failed${NC}"

# Deploy application
echo ""
echo -e "${YELLOW}Starting deployment to Railway...${NC}"
echo -e "${YELLOW}This may take 2-3 minutes...${NC}"
echo ""

railway up

# Watch logs
echo ""
echo -e "${GREEN}✅ DEPLOYMENT STARTED!${NC}"
echo ""
echo "📡 Watching logs (press Ctrl+C to stop)..."
echo "🔍 Look for: ✅ ALL AGENTS STARTED SUCCESSFULLY"
echo ""

railway logs --follow

