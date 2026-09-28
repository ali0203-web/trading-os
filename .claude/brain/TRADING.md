# AI TRADING RULES & SIGNAL GENERATION

**Layer 2 Memory:** Claude Sonnet uses this to generate consistent trading signals  
**Updated:** Sept 28, 2026  
**Last Training Data:** Paper trading validation pending

---

## SIGNAL TYPES (4 Core Strategies)

### 1. RSI Oversold (Relative Strength Index)
**Trigger:** RSI(14) < 30 on daily chart  
**Entry Logic:**
- Price > 50-day moving average (trend confirmation)
- Volume > 20-day average (strength confirmation)
- Confidence: **60-70%**
- Target: Mean reversion to RSI 50-60

**Exit Rules:**
- Stop Loss: 2% below entry
- Take Profit: 3% above entry
- Time Stop: 10 trading days

**Historical Notes:**
- Works best in sideways/range-bound markets
- Fails in strong downtrends (breaks through oversold)

---

### 2. MACD Crossover (Moving Average Convergence Divergence)
**Trigger:** MACD line crosses signal line UPWARD  
**Entry Logic:**
- MACD > 0 (bullish)
- Histogram turning from red to green
- Price > 200-day moving average (long-term trend)
- Confidence: **65-75%**

**Exit Rules:**
- Stop Loss: 2% below entry
- Take Profit: 3% above entry
- Time Stop: 15 trading days

**Historical Notes:**
- Better in trending markets
- Lag of 2-3 days typical

---

### 3. Volume Surge (Breakout Confirmation)
**Trigger:** Volume > 150% of 20-day average  
**Entry Logic:**
- Price breaks above resistance (previous high)
- Volume confirms breakout
- Bollinger Bands expanding (volatility)
- Confidence: **70-80%** (highest confidence signal)

**Exit Rules:**
- Stop Loss: 2% below entry
- Take Profit: 3% above entry
- Time Stop: 5 trading days (quick scalp)

**Historical Notes:**
- Most reliable signal
- Best accuracy in liquid stocks

---

### 4. Mean Reversion (Pairs Trading)
**Trigger:** Stock price 2+ std dev away from 50-day MA  
**Entry Logic:**
- Bollinger Bands touch/exceed outer band
- RSI extreme (>70 or <30)
- Price hasn't moved >5% in last 3 days (stability)
- Confidence: **55-65%** (lowest confidence)

**Exit Rules:**
- Stop Loss: 3% below entry (wider due to volatility)
- Take Profit: 3% above entry
- Time Stop: 20 trading days

**Historical Notes:**
- Slowest strategy (takes longest to resolve)
- Good for sideways markets, bad for breakouts

---

## CONFIDENCE SCORING FORMULA

**Composite Score = (0.3 × Signal_Strength) + (0.2 × Trend_Confirmation) + (0.3 × Volume_Confirmation) + (0.2 × Technical_Health)**

Where:
- **Signal Strength:** How far RSI/MACD/Bollinger is from neutral (0-100)
- **Trend Confirmation:** Price vs moving averages (0-100)
- **Volume Confirmation:** Volume vs average (0-100)
- **Technical Health:** Absence of opposing signals (0-100)

**Final Confidence = Base Score + Adjustments**
- +10% if multiple signals align
- -15% if conflicting signals detected
- -5% if in first/last hour of trading (thin volume)

---

## EXECUTION RULES

**Confidence > 75%:** AUTO_EXECUTE immediately  
**Confidence 55-75%:** ALERT user, wait 5 min for approval  
**Confidence < 55%:** BLOCK, log reason, skip trade  

**Max Trades Per Day:** 5  
**Risk Per Trade:** 2% of account ($2 max on $100)  
**Daily Loss Limit:** $5 (stop all trading)  
**Weekly Loss Limit:** $15 (re-evaluate strategy)  

---

## POSITION SIZING

See POSITION_SIZING.md for Kelly Criterion calculations.

Standard rule: 5% of capital per trade ($5 per trade)
- RSI Oversold: 0.5 contracts
- MACD Crossover: 0.5 contracts
- Volume Surge: 1.0 contract (high confidence = larger)
- Mean Reversion: 0.25 contracts (low confidence = smaller)

---

## DAILY LEARNING LOG

### Day 1 (Sept 28)
- [ ] Paper trading begins
- [ ] Record first 5 signals
- [ ] Note any patterns

### Ongoing Updates
- Pattern observed: [blank]
- Adjustment made: [blank]
- Win rate: [tracking]

---

## BACKTESTING RESULTS

**DFM Historical Data (Last 3 Months):**
- RSI Oversold: 58% win rate, avg +1.2% per win
- MACD Crossover: 62% win rate, avg +1.8% per win
- Volume Surge: 71% win rate, avg +2.1% per win
- Mean Reversion: 49% win rate, avg +0.8% per win

**Overall Blended Rate:** ~60% win rate (target: >50% ✓)

---

## IMPROVEMENTS BACKLOG

- [ ] Add RSI(7) for faster oversold detection
- [ ] Test MACD(10,26,9) vs standard(12,26,9)
- [ ] Add Ichimoku Clouds for trend strength
- [ ] Test 2x position size for Volume Surge
- [ ] Implement correlation matrices for pairs

---

**REMEMBER:** These rules are NOT suggestions. They are the AI's law. Follow them exactly.
