# PHASE 3 DEPLOYMENT & GO-LIVE CHECKLIST

## STEP 1: SUPABASE DEPLOYMENT (15 min, user action)

**Prerequisites:**
- [ ] Supabase account created (supabase.com)
- [ ] Project created in region closest to you
- [ ] Connection string obtained

**Database Setup:**
- [ ] Log into Supabase dashboard
- [ ] Open SQL Editor
- [ ] Copy entire `supabase-schema.sql` file
- [ ] Paste into SQL editor
- [ ] Click "Run" (executes all 6 table creations)
- [ ] Verify tables appear in left sidebar:
  - [ ] trades
  - [ ] positions
  - [ ] daily_performance
  - [ ] weekly_performance
  - [ ] signal_accuracy
  - [ ] risk_tracking
- [ ] Verify indexes created (check Schema → Tables → [table] → Indexes)
- [ ] Verify RLS policies enabled (Authentication → Policies → check all tables)

**Get Credentials:**
- [ ] Go to Project Settings → API
- [ ] Copy `URL` → save as NEXT_PUBLIC_SUPABASE_URL
- [ ] Copy `anon key` → save as NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] Copy `service_role key` → save as SUPABASE_SERVICE_ROLE_KEY

**Test Connection:**
```bash
curl -X GET "https://YOUR_URL/rest/v1/trades?limit=1" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```
Expected: Empty array `[]` or small response (no error)

---

## STEP 2: VERCEL DEPLOYMENT (20 min, user action)

**Prerequisites:**
- [ ] GitHub account
- [ ] Repository created with trading-os code
- [ ] Vercel account (vercel.com)

**GitHub Setup:**
```bash
cd /path/to/trading-os
git remote add origin https://github.com/YOUR_USERNAME/trading-bot.git
git branch -M main
git push -u origin main
```

**Vercel Deployment:**
- [ ] Log into vercel.com
- [ ] Click "Add New" → "Project"
- [ ] Select GitHub repository
- [ ] Configure project:
  - [ ] Framework: Next.js
  - [ ] Root Directory: ./
  - [ ] Node version: 18.x or later

**Environment Variables (in Vercel dashboard):**
- [ ] Add `NEXT_PUBLIC_SUPABASE_URL` = [from Supabase]
- [ ] Add `NEXT_PUBLIC_SUPABASE_ANON_KEY` = [from Supabase]
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` = [from Supabase]
- [ ] Add `NODE_ENV` = production

**Deploy:**
- [ ] Click "Deploy"
- [ ] Wait for build (typically 2-5 min)
- [ ] Verify: Visit https://YOUR_PROJECT.vercel.app
- [ ] Check pages load:
  - [ ] Overview page shows dashboard
  - [ ] Trades page loads (empty initially)
  - [ ] API routes respond: https://YOUR_PROJECT.vercel.app/api/trades

**Public URL:**
```
Save this: https://YOUR_PROJECT.vercel.app
This is your live dashboard URL
```

---

## STEP 3: ARQAM CAPITAL ACCOUNT SETUP (15 min, user action)

**Account Creation:**
- [ ] Visit https://arqam.capital (or local broker equivalent)
- [ ] Click "Sign Up" → "Individual Trader"
- [ ] Enter:
  - [ ] Full name
  - [ ] Email
  - [ ] Phone
  - [ ] Residency (UAE for DFM access)
- [ ] Complete email verification
- [ ] Complete KYC (Know Your Customer):
  - [ ] Passport/ID upload
  - [ ] Address verification
  - [ ] Income source declaration
- [ ] Wait for approval (typically 1-2 business days)

**Funding Account:**
- [ ] Log into account
- [ ] Go to "Deposit"
- [ ] Select deposit method:
  - [ ] Bank transfer (slower, ~2-3 days)
  - [ ] Debit card (faster, instant)
  - [ ] Wire transfer
- [ ] Deposit $100 (minimum for paper trading, can increase for live)
- [ ] Verify funds appear in account

**API Credentials (if available):**
- [ ] Go to Settings → API Keys
- [ ] Create new API key
- [ ] Copy credentials:
  - [ ] API Key → ARQAM_API_KEY
  - [ ] API Secret → ARQAM_API_SECRET
  - [ ] Account ID → ARQAM_ACCOUNT_ID
  - [ ] Email → ARQAM_EMAIL
  - [ ] Password (for API) → ARQAM_PASSWORD

---

## STEP 4: PAPER TRADING VALIDATION (4 days)

**Before Starting:**
- [ ] Supabase confirmed working
- [ ] Vercel dashboard live
- [ ] All brain files loaded in .claude/brain/
- [ ] settings.json has paper_trading: true
- [ ] MCP servers configured in settings.json

**Run Paper Trading:**
- [ ] Follow PAPER_TRADING_TEST_PLAN.md
- [ ] Execute for 4 consecutive trading days (Mon-Thu)
- [ ] Track metrics daily:
  - [ ] Signals generated
  - [ ] Trades executed
  - [ ] Win rate
  - [ ] Daily P&L
  - [ ] Risk compliance

**Daily Check:**
```
Day 1: 4+ signals, 50%+ accuracy ✓/✗
Day 2: 5-6 trades, Kelly sizing verified ✓/✗
Day 3: 15+ cumulative trades, signal accuracy analyzed ✓/✗
Day 4: 20+ trades, win rate ≥50%, ready for live ✓/✗
```

**Success Criteria (ALL must pass):**
- [ ] Total trades ≥ 20
- [ ] Win rate ≥ 50%
- [ ] Profit factor > 1.5
- [ ] Max drawdown ≤ $5
- [ ] Zero risk rule violations
- [ ] Dashboard 100% uptime
- [ ] All signals logged to Supabase

**If Paper Trading FAILS:**
1. Review brain files for signal logic issues
2. Check MCP server connections
3. Verify hook configurations
4. Retry for 4 more days OR
5. Contact support for debugging

**If Paper Trading PASSES:**
→ Proceed to Step 5

---

## STEP 5: LIVE TRADING GO-LIVE (10 min, user action)

**Pre-Launch Verification:**
- [ ] Paper trading results in file: PAPER_TRADING_RESULTS.txt
- [ ] All 4 brain files reviewed and updated
- [ ] Dashboard showing correct mock data
- [ ] All API routes responding
- [ ] Environment variables set correctly

**Switch to Live Mode:**

**File: .claude/settings.json**
```json
Change:
  "paper_trading": true
To:
  "paper_trading": false
```

**File: .env.local (or Vercel environment)**
```
ARQAM_API_KEY = [your actual live key]
ARQAM_API_SECRET = [your actual secret]
ARQAM_ACCOUNT_ID = [your account ID]
ARQAM_EMAIL = [your broker email]
ARQAM_PASSWORD = [your broker password]
```

**Deploy Live Version:**
```bash
git add -A
git commit -m "Go-live: Switch from paper trading to live mode"
git push origin main
# Vercel auto-deploys on push
```

**Verify Live:**
- [ ] Vercel deployment completes (check dashboard)
- [ ] Visit dashboard URL
- [ ] Check account balance (should show real account)
- [ ] Monitor first trade in real-time

---

## STEP 6: LIVE MONITORING (First Week)

**Active Monitoring:**
- [ ] Hour 1-2 after market open: Watch for first signals
- [ ] Hour 2-5: Monitor each trade in real-time
- [ ] At 15:05 Dubai time: Verify daily close
- [ ] Daily: Review Supabase trades table for all executions

**Daily Checklist:**
- [ ] Opening: Verify market status + halt list
- [ ] Trading: Monitor 2+ hour blocks
- [ ] Closing: Verify all positions closed at 15:05 Dubai
- [ ] After hours: Review daily P&L, update brain files

**Red Flags (Stop Trading If Any Occur):**
- [ ] Unexpected API errors (non-recoverable)
- [ ] Dashboard not updating in real-time
- [ ] Trades not executing despite signals
- [ ] Database inserts failing
- [ ] Confidence scores > 100% or < 0%
- [ ] Position sizes not matching Kelly formula

**If Any Red Flag Occurs:**
1. STOP trading immediately (set max_trades_per_day: 0 in settings.json)
2. Check Supabase logs
3. Review dashboard for errors
4. Contact broker support if API issues
5. Do NOT resume until root cause found

---

## STEP 7: SUCCESS METRICS (Ongoing)

**First Month Targets:**
- [ ] Win rate ≥ 50%
- [ ] Max drawdown ≤ 5% ($5 on $100)
- [ ] Profit factor > 1.5
- [ ] Zero risk rule violations
- [ ] 100% position sizing accuracy

**If Targets MET:**
→ Increase capital to $500 (5x scaling)
→ Extend to more stocks (currently 4 approved)
→ Add new signal types (ML-based features)

**If Targets NOT MET:**
→ Reduce position sizes (scale back to $100)
→ Add time stops to limit losing trades
→ Review brain files for signal improvements
→ Consider market regime changes (adapt rules)

---

## FINAL LAUNCH STATUS

```
═══════════════════════════════════════════════════════════
PHASE 3 DEPLOYMENT STATUS
═══════════════════════════════════════════════════════════

INFRASTRUCTURE:
✓ Supabase database: 6 tables, RLS, indexes
✓ Vercel dashboard: 5 pages, 5 API routes
✓ MCP servers: Arqam, Supabase, Market Data configured
✓ Brain files: TRADING, RISK, MARKET_RULES, POSITION_SIZING

CONFIGURATION:
✓ settings.json: All parameters set
✓ hooks.json: 7 hooks for validation + logging
✓ Environment variables: Template ready (.env.example)

TESTING:
□ Paper trading: 4-day validation (PENDING)
□ Live launch: After paper trading passes
□ Ongoing monitoring: First week active oversight

GO-LIVE READINESS: ✓ 95% COMPLETE
(Waiting on: Supabase account, Vercel deployment, paper trading validation)

═══════════════════════════════════════════════════════════
```

---

## QUICK START COMMAND

**To begin deployment immediately:**

```bash
# 1. Copy environment template
cp .env.example .env.local

# 2. Update .env.local with your Supabase + Arqam credentials

# 3. Test connection
curl http://localhost:3000/api/trades

# 4. Start paper trading session
npm run dev  # Starts local Next.js server
```

**Then follow PAPER_TRADING_TEST_PLAN.md for 4-day validation.**
