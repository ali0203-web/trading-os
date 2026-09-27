# 🚀 ONE COMMAND DEPLOYMENT

**That's it. Just run one command and everything happens automatically.**

---

## Step 1: Organize Files

Copy all files from `/scratchpad/` to your project directory:

```
trading-agents/
├── index.js
├── package.json
├── Dockerfile
├── railway.json
├── .env.example
├── .gitignore
├── lib/
├── agents/
├── database/
└── deploy.sh (or deploy.bat on Windows)
```

---

## Step 2: Run Deployment Script

### **On Mac/Linux:**
```bash
chmod +x deploy.sh
./deploy.sh
```

### **On Windows:**
```bash
deploy.bat
```

---

## Step 3: Follow Prompts

The script will ask you:

```
Enter your Discord webhook URL (from DISCORD_SETUP_QUICK.md): 
```

**Paste your Discord webhook URL** (from Step 1 of Discord setup)

---

## Step 4: Watch It Deploy

The script will:
1. ✅ Install Railway CLI (if needed)
2. ✅ Login to your Railway account
3. ✅ Link to your project
4. ✅ Add PostgreSQL
5. ✅ Set all Binance/Discord variables
6. ✅ Deploy application
7. ✅ Watch logs in real-time

---

## What You'll See

```
🚀 AUTONOMOUS TRADING AGENTS - AUTOMATED DEPLOYMENT
====================================================

📦 Checking Railway CLI...
🔐 Checking Railway login...
🔗 Linking to Railway project...
📊 Checking PostgreSQL...
⏳ Waiting for PostgreSQL to initialize...
🔑 Setting environment variables...
✅ BINANCE_TESTNET_API_KEY
✅ BINANCE_TESTNET_SECRET_KEY
✅ DISCORD_WEBHOOK_URL
✅ TRADING_MODE
✅ LOG_LEVEL
✅ NODE_ENV

Starting deployment to Railway...
This may take 2-3 minutes...

📡 Watching logs (press Ctrl+C to stop)...
🔍 Look for: ✅ ALL AGENTS STARTED SUCCESSFULLY
```

---

## Success Indicator

**When you see this → YOU'RE LIVE! 🎉**

```
✅ Database schema initialized successfully
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

📡 System is operational. Monitoring in progress...
```

---

## That's It!

No more manual steps. Just:

```
1. Copy files
2. Run script
3. Enter Discord webhook URL
4. Watch it deploy
5. System LIVE ✅
```

**Total time: ~5 minutes**

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "railway not found" | Run: `npm install -g @railway/cli` |
| "Not logged in" | Browser will open for login, complete it |
| "Project not linked" | Script will ask you to select project |
| "Discord webhook not working" | Make sure you copied it exactly from Discord |

---

**Ready? Run the script now!** 🚀
