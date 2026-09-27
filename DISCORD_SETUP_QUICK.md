# ⚡ Discord Bot Setup - 3 Minutes

---

## Step 1: Create Bot (1 minute)

Go to: https://discord.com/developers/applications

1. Click **New Application**
2. Name it: `Trading Alerts`
3. Click **Create**

---

## Step 2: Generate Token (1 minute)

1. Left menu → **Bot**
2. Click **Add Bot**
3. Under TOKEN → Click **Copy**
4. **SAVE THIS** (you'll need it)

```
YOUR_BOT_TOKEN_HERE
(copy and save it)
```

---

## Step 3: Add Permissions (30 seconds)

1. Left menu → **OAuth2** → **URL Generator**
2. Check these scopes:
   - ✅ bot

3. Check these permissions:
   - ✅ Send Messages
   - ✅ Embed Links
   - ✅ Manage Webhooks

4. Copy the **Generated URL**

---

## Step 4: Add Bot to Discord (30 seconds)

1. Paste the URL in your browser
2. Select your Discord server
3. Click **Authorize**
4. ✅ Bot now in your Discord!

---

## Step 5: Create Webhook (1 minute)

**In your Discord server:**

1. Right-click on channel → **Edit Channel**
2. Left menu → **Integrations** → **Webhooks**
3. Click **New Webhook**
4. Name it: `Trading Alerts`
5. Click **Copy Webhook URL**

```
https://discord.com/api/webhooks/YOUR_WEBHOOK_URL_HERE
(copy and save it)
```

---

## Step 6: Add to Railway (1 minute)

**Now set the webhook in Railway:**

```bash
railway variables set DISCORD_WEBHOOK_URL "https://discord.com/api/webhooks/YOUR_WEBHOOK_URL_HERE"

# Restart Railway
railway restart
```

---

## ✅ Done!

You now have:
- ✅ Discord Bot created
- ✅ Webhook URL configured
- ✅ Alerts will send to your Discord channel

**Total time: ~5 minutes**

---

## 🧪 Test It

Once deployed, you'll see alerts like:

```
Trading Agent Alert Batch (5 alerts)

📈 BUY BTCUSDT
0.5 @ Market | Status: FILLED

⚠️  High Error Rate
3 errors in last hour

💰 Daily Report
Value: $1,250.50 | P&L: +$50.50 (4.2%)
```

---

**Continue to DEPLOYMENT_GUIDE.md for next steps →**
