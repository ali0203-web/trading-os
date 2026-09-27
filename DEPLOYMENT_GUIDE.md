# Railway Deployment Guide

**Time to deploy: ~10 minutes**

---

## Step 1: Prepare Your Environment Variables

Create a `.env` file with your credentials:

```bash
# Copy template
cp .env.example .env

# Edit .env and fill in:
DATABASE_URL=postgresql://...  # Railway will provide this
BINANCE_TESTNET_API_KEY=oibQy50SPkGO1WQLsNmO2jrqiHmbEJBlqURlXuh0OSCzvSwTc5okcyAa22STOPm
BINANCE_TESTNET_SECRET_KEY=eGpKKMoW8Oh7n5qmzfNRT9E6KG3a2EFqebCK88syRuhzObwA2BEMW5laTXtQ0ZSE
TRADING_MODE=TESTNET
LOG_LEVEL=info
NODE_ENV=production
```

**✅ Keep these safe - don't commit to git!**

---

## Step 2: Install Railway CLI

```bash
# Install Railway CLI (macOS/Linux)
curl -fsSL https://railway.app/install.sh | sh

# Or via npm
npm install -g @railway/cli

# Verify installation
railway --version
```

---

## Step 3: Login to Railway

```bash
# Login (opens browser)
railway login

# Confirm you're logged in
railway whoami
```

---

## Step 4: Create/Link Railway Project

**Option A: Create New Project**
```bash
# Create new project
railway create trading-agents

# This will create a new Railway project
```

**Option B: Use Existing Project**
```bash
# Link to your existing Railway project
railway link

# Select your project when prompted
```

---

## Step 5: Add PostgreSQL Database

```bash
# Add PostgreSQL plugin to project
railway add

# Select "PostgreSQL" from the list
# Railway will automatically provision the database
# and set DATABASE_URL environment variable
```

**Verify it was added:**
```bash
railway service list

# You should see:
# - your-app (Node.js)
# - postgres (PostgreSQL)
```

---

## Step 6: Configure Environment Variables

Railway automatically provides `DATABASE_URL` from PostgreSQL.

**Add your Binance keys:**

```bash
# Set variables one by one
railway variables set BINANCE_TESTNET_API_KEY "oibQy50SPkGO1WQLsNmO2jrqiHmbEJBlqURlXuh0OSCzvSwTc5okcyAa22STOPm"
railway variables set BINANCE_TESTNET_SECRET_KEY "eGpKKMoW8Oh7n5qmzfNRT9E6KG3a2EFqebCK88syRuhzObwA2BEMW5laTXtQ0ZSE"
railway variables set TRADING_MODE "TESTNET"
railway variables set LOG_LEVEL "info"
railway variables set NODE_ENV "production"
```

**Verify all variables are set:**
```bash
railway variables list
```

---

## Step 7: Deploy to Railway

```bash
# Deploy your code
railway up

# This will:
# 1. Build Docker image
# 2. Upload to Railway
# 3. Start the application
# 4. Initialize database
# 5. Start all 9 agents
```

**First deploy may take 2-3 minutes**

---

## Step 8: Verify Deployment

```bash
# View logs in real-time
railway logs

# You should see:
# ✅ Database schema initialized
# ✅ Order Execution Agent started
# ✅ Market Data Agent started
# ✅ Portfolio Monitor Agent started
# ... (all 9 agents)
# ✅ ALL AGENTS STARTED SUCCESSFULLY
```

**If you see errors, check:**
- [ ] Database URL is set correctly
- [ ] Binance API keys are valid
- [ ] All required environment variables present
- [ ] Node version compatible (18+)

---

## Step 9: Set Up Discord Webhook

### Option A: I'll Create It (Recommended)

**Send me:**
1. Discord server name or invite link
2. Confirm it's ready

**I'll:**
1. Create Discord Bot account
2. Generate webhook URL
3. Set it in your Railway environment

### Option B: You Create It

**Steps:**
1. Go to Discord Server Settings → Integrations → Webhooks
2. Create New Webhook
3. Name it: "Trading Alerts"
4. Copy the webhook URL
5. Set it in Railway:
```bash
railway variables set DISCORD_WEBHOOK_URL "https://discord.com/api/webhooks/..."
```

---

## Step 10: Restart Application (After Discord Setup)

```bash
# Railway will restart automatically after you set DISCORD_WEBHOOK_URL
# Or manually restart:
railway restart

# Watch logs confirm startup
railway logs
```

---

## ✅ Verification Checklist

After deployment, verify these in order:

### Check 1: Database Connected
```
✅ "Database schema initialized successfully"
```

### Check 2: All Agents Started
Look for these in logs:
```
✅ Order Execution Agent started
✅ Market Data Agent started
✅ Portfolio Monitor Agent started
✅ Risk Management Agent started
✅ Error Recovery Agent started
✅ Reconciliation Agent started
✅ Notification Agent started
✅ Monitoring Agent started
✅ Queue Manager started
✅ ALL AGENTS STARTED SUCCESSFULLY
```

### Check 3: Market Data Streaming
```
✅ Subscribed to price updates: BTCUSDT, ETHUSDT, ...
✅ Price update stored in market_data
```

### Check 4: Portfolio Monitoring
```
✅ Portfolio monitoring cycle started
✅ Portfolio balanced, no rebalancing needed
```

### Check 5: System Monitoring
```
✅ SYSTEM MONITORING REPORT (every 60 seconds)
   ✅ All agents HEALTHY
```

### Check 6: Discord Connected
```
✅ Discord webhook configured
✅ Sent X alerts to Discord
```

---

## 🐛 Troubleshooting

### Error: "Missing BINANCE_TESTNET_API_KEY"
```
→ Set the variable: railway variables set BINANCE_TESTNET_API_KEY "your-key"
→ Restart: railway restart
```

### Error: "Connection refused (PostgreSQL)"
```
→ PostgreSQL not ready yet (takes 30-60 seconds)
→ Wait and check again: railway logs
→ Or restart: railway restart
```

### Error: "Discord webhook not configured"
```
→ This is normal until you set DISCORD_WEBHOOK_URL
→ Alerts won't send but system runs fine
→ Discord is optional for testnet
```

### Agents not starting
```
→ Check: railway logs
→ Look for error messages in first 100 lines
→ Common issues:
   - Invalid API keys
   - Missing environment variables
   - Database not ready
```

### High memory usage
```
→ Normal for 9 concurrent agents
→ Hobby plan has 512MB, should be sufficient
→ Monitor: railway logs | grep memory
```

---

## 📊 Monitoring Commands

**View all services:**
```bash
railway service list
```

**View environment variables:**
```bash
railway variables list
```

**View logs (live):**
```bash
railway logs --follow
```

**View logs (last 100 lines):**
```bash
railway logs | tail -100
```

**SSH into the container:**
```bash
railway shell
```

**Restart the application:**
```bash
railway restart
```

---

## 🔄 Updating Code

When you make changes:

```bash
# Stage changes
git add .

# Commit
git commit -m "Update trading rules"

# Deploy
railway up
```

Railway automatically redeploys on `railway up`

---

## 📈 Next Steps

After deployment:

1. **Monitor logs for 1 hour** - Verify stable operation
2. **Start IB KYC** - Parallel to testing (Week 2-3)
3. **Run 48-72 hour paper trading test** - See system in action
4. **Review daily reports** - Check Discord for alerts
5. **Prepare legal authorization** - For real money phase
6. **Plan Week 3 transition** - Switch to live trading

---

## ✨ You're Ready!

**Run deployment now:**

```bash
# 1. Set environment variables
railway variables set BINANCE_TESTNET_API_KEY "your-key"
railway variables set BINANCE_TESTNET_SECRET_KEY "your-secret"

# 2. Deploy
railway up

# 3. Monitor
railway logs

# 4. Verify all agents started ✅
```

**Estimated time to live: 10 minutes**

Questions? Check the logs - they're detailed and helpful! 🚀
