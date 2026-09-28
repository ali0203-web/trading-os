# POSITION SIZING CALCULATIONS (Kelly Criterion)

**Layer 2 Memory:** Exact position sizes for each trade scenario  
**Updated:** Sept 28, 2026  
**Philosophy:** "Risk what you can afford to lose"

---

## KELLY CRITERION FORMULA (Refresher)

```
f* = (p × b - q) / b
```

Where:
- f* = Fraction of capital to risk
- p = Win probability (60% = 0.60)
- q = Loss probability (40% = 0.40)
- b = Win/loss ratio (1.5 = avg win is 1.5x avg loss)

**Our Values:**
- p = 0.60 (60% win rate from backtesting)
- q = 0.40 (40% loss rate)
- b = 1.5 (avg win = 1.5x avg loss)

**Calculation:**
```
f* = (0.60 × 1.5 - 0.40) / 1.5
f* = (0.90 - 0.40) / 1.5
f* = 0.50 / 1.5
f* = 0.333... = 33.3% (FULL KELLY)
```

**Fractional Kelly (25% of Full):**
```
0.333 × 0.25 = 0.0825 = 8.25%
```

**Our Conservative (5%):**
```
We use 5% instead of 8.25% for safety.
Better to survive than maximize growth.
```

---

## POSITION SIZE BY SIGNAL TYPE

### Volume Surge (Highest Confidence: 70-80%)
**Confidence Score:** 75% (average)  
**Position Size:** 1.0 share (or contract equivalent)  
**Risk per Share:** 2% stop loss  
**Capital Risked:** 5% of $100 = $5  

**Example Trade:**
- Stock: Emaar Properties
- Current Price: 7.20 AED
- Entry: 7.20 AED (market order)
- Stop Loss: 7.06 AED (2% below entry)
- Take Profit: 7.42 AED (3% above entry)
- Shares: 1 share
- Risk Amount: (7.20 - 7.06) × 1 = 0.14 AED ≈ $0.04
- **WAIT: This is only $0.04 risk, not $5**

**RECALCULATION:**
To risk $5 (our 5% position size):
- Risk per share = 2% of $7.20 = $0.144
- Shares needed to risk $5: $5 / $0.144 = **34.7 shares**

**So:** Buy 35 shares of Emaar to risk ~$5

---

### MACD Crossover (Medium Confidence: 65-75%)
**Confidence Score:** 70% (average)  
**Position Size:** 0.5 shares (scaled down)  
**Risk per Share:** 2% stop loss  
**Capital Risked:** 2.5% of $100 = $2.50  

**Example Trade:**
- Stock: ENBD (Emirates NBD)
- Current Price: 9.50 AED
- Entry: 9.50 AED
- Stop Loss: 9.31 AED (2% below)
- Take Profit: 9.79 AED (3% above)
- Risk per share: 0.19 AED
- Shares to risk $2.50: $2.50 / $0.19 = **13.2 shares**

**So:** Buy 13 shares of ENBD to risk ~$2.50

---

### RSI Oversold (Medium Confidence: 60-70%)
**Confidence Score:** 65% (average)  
**Position Size:** 0.5 shares (scaled down)  
**Risk per Share:** 2% stop loss  
**Capital Risked:** 2.5% of $100 = $2.50  

**Example Trade:**
- Stock: ADIB (Abu Dhabi Islamic Bank)
- Current Price: 5.80 AED
- Entry: 5.80 AED
- Stop Loss: 5.68 AED (2% below)
- Take Profit: 5.97 AED (3% above)
- Risk per share: 0.12 AED
- Shares to risk $2.50: $2.50 / $0.12 = **20.8 shares**

**So:** Buy 21 shares of ADIB to risk ~$2.50

---

### Mean Reversion (Lowest Confidence: 55-65%)
**Confidence Score:** 60% (average)  
**Position Size:** 0.25 shares (quarter size)  
**Risk per Share:** 2% stop loss  
**Capital Risked:** 1.25% of $100 = $1.25  

**Example Trade:**
- Stock: DP World
- Current Price: 35.00 AED
- Entry: 35.00 AED
- Stop Loss: 34.30 AED (2% below)
- Take Profit: 36.05 AED (3% above)
- Risk per share: 0.70 AED
- Shares to risk $1.25: $1.25 / $0.70 = **1.8 shares**

**So:** Buy 2 shares of DP World to risk ~$1.40

---

## MULTIPLE CONCURRENT POSITIONS

**Max Positions Open:** 5 simultaneously  
**Max Capital per Position:** 5% ($5)  
**Max Total Capital Deployed:** 100% ($100)

### Scenario: 3 Open Positions
```
Position 1 (Volume Surge - Emaar): +$5 risk, currently +$2.50 gain
Position 2 (MACD - ENBD): +$2.50 risk, currently -$1.00 loss
Position 3 (RSI - ADIB): +$2.50 risk, currently +$0.50 gain

Total Deployed: $5 + $2.50 + $2.50 = $10 (10% of capital)
Current P&L: +$2.50 - $1.00 + $0.50 = +$2.00 net
Available Capital: $100 - $10 = $90 (for new trades)
```

### New Signal: Buy DP World (Mean Reversion)
- Risk: $1.25
- Total Deployed: $10 + $1.25 = $11.25
- Still under our $100 limit ✓
- Can accept this trade

---

## DYNAMIC ADJUSTMENTS (Based on Win Rate)

### If Win Rate > 60% (Winning Streak)
**Adjustment:** Increase position size by 25%
```
Volume Surge: 1.0 → 1.25 shares
MACD: 0.5 → 0.625 shares
RSI: 0.5 → 0.625 shares
Mean Reversion: 0.25 → 0.31 shares

Total Risk per Day: $5 → $6.25
```

**Rule:** Only do this after 10+ winning trades at 60%+ rate

### If Win Rate 50-60% (Normal)
**Adjustment:** Keep position size normal (1.0 / 0.5 / 0.5 / 0.25)

### If Win Rate < 50% (Losing Streak)
**Adjustment:** Decrease position size by 40%
```
Volume Surge: 1.0 → 0.6 shares
MACD: 0.5 → 0.3 shares
RSI: 0.5 → 0.3 shares
Mean Reversion: 0.25 → 0.15 shares

Total Risk per Day: $5 → $3
```

**Rule:** Do this immediately if win rate drops below 50%

---

## ADJUSTMENTS BASED ON DRAWDOWN

### If Max Drawdown > 3% of Capital ($3 loss)
**Action:** Tighten stops
- Stop Loss: 2% → 1.5%
- Take Profit: Keep 3%
- Result: Smaller per-trade risk

### If Max Drawdown > 5% of Capital ($5 loss - DAILY LIMIT)
**Action:** STOP ALL TRADING
- Close all positions
- Re-evaluate strategy
- Wait 1 day before resuming
- May need to reduce position sizes

---

## POSITION SIZING LOOKUP TABLE

| Signal | Confidence | Position | Risk | Sample Stock | Shares |
|--------|------------|----------|------|--------------|--------|
| Volume | 70-80% | 1.0x | $5.00 | Emaar (7.20) | 35 |
| MACD | 65-75% | 0.5x | $2.50 | ENBD (9.50) | 13 |
| RSI | 60-70% | 0.5x | $2.50 | ADIB (5.80) | 21 |
| Mean Rev | 55-65% | 0.25x | $1.25 | DP World (35) | 2 |

---

## CALCULATION TEMPLATE (Use For Every Trade)

```
Stock: _____________
Current Price: _____________
Entry Price: _____________
Stop Loss Price: _____________ (2% below entry)
Take Profit Price: _____________ (3% above entry)

Risk per Share = Stop Loss Price - Entry Price
Risk per Share = _____________

Shares to Risk $X:
Shares = Desired Risk / Risk per Share
Shares = $5.00 / _____________ = _____________

Final Position Size: _____________  shares
Final Risk Amount: $_____________
```

---

## MEMORY AIDS

**Volume Surge = Biggest Position**
- Highest confidence (70-80%)
- Takes 1.0x position
- Risks full $5

**MACD/RSI = Medium Positions**
- Medium confidence (60-75%)
- Takes 0.5x position each
- Risk $2.50 each

**Mean Reversion = Smallest Position**
- Lowest confidence (55-65%)
- Takes 0.25x position
- Risk $1.25

**Total per day = $5 + $2.50 + $2.50 + $1.25 = $11.25 max** (but spread across multiple days)

---

**CORE PRINCIPLE:** Position sizing is NOT flexible. Calculate it precisely. No "intuition" or "feeling."

**THE MATH PROTECTS US:** Every share count is justified by Kelly Criterion.

Calculate. Then trade. Never trade without calculation.
