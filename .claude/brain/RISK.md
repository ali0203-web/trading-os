# RISK MANAGEMENT FRAMEWORK

**Layer 2 Memory:** Claude enforces risk limits autonomously via pre-approval hooks  
**Updated:** Sept 28, 2026  
**Philosophy:** "Preserve capital first, grow it second"

---

## KELLY CRITERION (Position Sizing Science)

### Derivation
**Kelly Formula:** f* = (p × b - q) / b

Where:
- **f*** = Fraction of capital to risk per trade
- **p** = Probability of winning (win rate)
- **q** = Probability of losing (1 - p)
- **b** = Win/loss ratio (avg win $ / avg loss $)

### Our Application

**Assumptions (from backtesting):**
- p = 60% (win rate)
- q = 40% (loss rate)
- b = 1.5 (we win 1.5x what we lose on average)

**Full Kelly:**
f* = (0.60 × 1.5 - 0.40) / 1.5
f* = (0.90 - 0.40) / 1.5
f* = 0.50 / 1.5
f* = **0.33 (33% of capital per trade)**

**Too aggressive for real trading.** Use fractional Kelly:

**Fractional Kelly (25% of Full):**
f* = 0.33 × 0.25 = **0.0825 ≈ 8.25%**

**Our Conservative Choice (5%):**
f* = **0.05 (5% of capital)**

Why 5% instead of 8.25%?
- Market conditions change
- Backtesting data has gaps
- Black swan events happen
- Better to survive drawdowns

---

## CAPITAL ALLOCATION ($100 Total)

| Category | Amount | Purpose |
|----------|--------|---------|
| **Trading Capital** | $100 | Execute all trades |
| **Daily Risk Limit** | $5 | Stop trading if lost |
| **Weekly Risk Limit** | $15 | Strategy review if hit |
| **Position Size** | $5 | 5% of capital per trade |
| **Min Position** | $0.50 | Smallest unit |

---

## EXECUTION CONFIDENCE THRESHOLDS

### Auto-Execute (No Approval Needed)
- **Trigger:** Confidence > 75%
- **Action:** Place order immediately
- **Logging:** Log to Supabase + Slack notification
- **Risk Check:** Validate $2 risk, daily limit, weekly limit
- **Time Window:** < 100ms to market

### Alert (User Approval)
- **Trigger:** Confidence 55-75%
- **Action:** Send alert to user
- **Timeout:** Wait max 5 minutes
- **If Approved:** Execute trade
- **If Rejected:** Log rejection reason
- **If Timeout:** Auto-reject (5 min expired)

### Block (Do Not Trade)
- **Trigger:** Confidence < 55%
- **Action:** Block trade immediately
- **Logging:** Log rejection reason
- **Retry:** Can try again next signal

---

## DAILY & WEEKLY LIMITS

### Daily Loss Limit: $5 (5% of capital)
**Trigger:** Daily cumulative loss >= $5  
**Action:** STOP ALL TRADING for rest of day  
**Reset:** Next trading day at market open  
**Reason:** Protect against spiral losses after bad day  

**Example:**
- Trade 1: -$1.50 (loss)
- Trade 2: -$2.00 (loss)
- Trade 3: -$1.60 (loss) → **TOTAL: -$5.10 → STOP TRADING**
- Trade 4: BLOCKED (daily limit reached)

### Weekly Loss Limit: $15 (15% of capital)
**Trigger:** Weekly cumulative loss >= $15  
**Action:** STOP ALL TRADING, re-evaluate strategy  
**Reset:** Monday market open (restart week)  
**Reason:** If strategy failing, need to diagnose before continuing  

**Example:**
- Monday-Wednesday: -$8
- Thursday: -$4
- Friday: -$3 → **TOTAL: -$15 → STOP + RE-EVALUATE**

---

## RISK METRICS TO TRACK

### Win Rate
**Definition:** (Wins / Total Trades) × 100%  
**Target:** > 50% (breakeven at 50%, profit at 55%+)  
**Check:** Daily, weekly, monthly  
**Action:** If falls below 50%, review signal quality  

### Profit Factor
**Definition:** (Total Wins $ / Total Losses $)  
**Target:** > 1.5 (earning 1.5x what we lose)  
**Check:** Weekly  
**Action:** If < 1.3, revisit position sizing or signal rules  

### Max Drawdown
**Definition:** Biggest peak-to-trough drop in account value  
**Target:** < 5% ($5 on $100)  
**Check:** Daily  
**Action:** If > 5%, stop trading and reset  

### Sharpe Ratio
**Definition:** (Average Daily Return - Risk-Free Rate) / Std Dev of Returns  
**Target:** > 1.0 (more return per unit of volatility)  
**Check:** Monthly  
**Action:** If < 0.8, strategy inefficient vs risk taken  

---

## POSITION SIZING TABLE

| Signal Type | Confidence | Position Size | Risk Amount |
|------------|------------|---|---|
| Volume Surge | 70-80% | 1.0 contract | $2.00 |
| MACD Crossover | 65-75% | 0.5 contract | $1.50 |
| RSI Oversold | 60-70% | 0.5 contract | $1.50 |
| Mean Reversion | 55-65% | 0.25 contract | $0.75 |

**Rule:** Risk = Position Size × Stop Loss %
- Volume Surge (1.0 × 2%) = $2.00 ✓
- MACD (0.5 × 2%) = $1.00 ✓
- RSI (0.5 × 2%) = $1.00 ✓
- Mean Reversion (0.25 × 2%) = $0.50 ✓

---

## DYNAMIC ADJUSTMENT RULES

### If Win Rate > 60%
- Increase position size to 6% of capital ($6)
- Increase daily limit to $6
- Maintain weekly limit at $15

### If Win Rate 50-60%
- Keep position size at 5% of capital ($5)
- Keep daily limit at $5
- Keep weekly limit at $15

### If Win Rate < 50%
- Decrease position size to 3% of capital ($3)
- Decrease daily limit to $3
- Decrease weekly limit to $10
- Review signal rules immediately

### If Max Drawdown > 3%
- Reduce position size by 25% (5% → 3.75%)
- Tighten stop loss from 2% → 1.5%
- Increase time stops (hold less days)

---

## PRE-APPROVAL HOOK RULES

These are ENFORCED AUTOMATICALLY by .claude/hooks.json:

### Before Every Trade
1. ✓ Is market open? (10:00-15:00 GST)
2. ✓ Is symbol approved? (ENBD, ADIB, Emaar, DP World)
3. ✓ Is risk ≤ 2%? (<= $2)
4. ✓ Is daily loss < $5?
5. ✓ Is weekly loss < $15?
6. ✓ Is confidence ≥ 55%?

**All 6 must pass, or trade is blocked.**

---

## RISK TRACKING CHECKLIST

**Daily (09:00 Dubai):**
- [ ] Check daily loss total
- [ ] Check if daily limit hit
- [ ] Review win rate (if 5+ trades)

**Weekly (Friday 17:00 Dubai):**
- [ ] Check weekly loss total
- [ ] Check profit factor
- [ ] Check max drawdown
- [ ] Review signal accuracy by type
- [ ] Adjust position sizes if needed

**Monthly (1st of month):**
- [ ] Calculate Sharpe ratio
- [ ] Review all metrics
- [ ] Update TRADING.md learnings
- [ ] Plan for next month

---

**CORE PRINCIPLE:** Risk management is NOT optional. It's the difference between long-term success and account blow-up.

**REMEMBER:** A trader who survives is a trader who profits. Preservation > Growth.
