# DFM MARKET RULES & CONSTRAINTS

**Layer 2 Memory:** Dubai Financial Market (UAE only)  
**Updated:** Sept 28, 2026  
**Timezone:** GST (Gulf Standard Time, UTC+4)

---

## TRADING HOURS (STRICT ENFORCEMENT)

**Market Open:** 10:00 AM GST  
**Market Close:** 3:00 PM GST (15:00)  
**Trading Window:** 10:00-15:00 GST ONLY  

**Pre-Market:** 09:30-10:00 (no trading)  
**Post-Market:** 15:00+ (no trading)  
**Weekends:** Friday 13:00-Sunday 09:30 (closed)  

**Holiday Schedule 2026:**
- Eid al-Fitr: ~April 9-12 (CLOSED)
- Arafat Day: ~June 14 (CLOSED)
- Eid al-Adha: ~June 16-18 (CLOSED)
- Islamic New Year: ~July 6 (CLOSED)
- Prophet's Birthday: ~Sept 16 (CLOSED)
- National Day: Dec 2-3 (CLOSED)

**Action:** Before every trade, check: `if now < 10:00 or now > 15:00, BLOCK trade`

---

## APPROVED LIQUID STOCKS (4 Only)

### 1. ENBD (Emirates NBD)
**Full Name:** Emirates National Bank of Dubai  
**Sector:** Banking  
**Avg Daily Volume:** 15-25M shares  
**Bid-Ask Spread:** 0.5-1.0 fils (very tight)  
**Tick Size:** 0.5 fils  
**Min Lot:** 1 share  
**Price Range:** 8-12 AED typically  
**Liquidity:** EXCELLENT ✓  

### 2. ADIB (Abu Dhabi Islamic Bank)
**Full Name:** Abu Dhabi Islamic Bank  
**Sector:** Banking (Islamic)  
**Avg Daily Volume:** 10-20M shares  
**Bid-Ask Spread:** 1.0-2.0 fils  
**Tick Size:** 1.0 fils  
**Min Lot:** 1 share  
**Price Range:** 5-7 AED typically  
**Liquidity:** EXCELLENT ✓  

### 3. Emaar (Emaar Properties)
**Full Name:** Emaar Properties PJSC  
**Sector:** Real Estate  
**Avg Daily Volume:** 30-50M shares  
**Bid-Ask Spread:** 0.5-1.5 fils  
**Tick Size:** 0.5 fils  
**Min Lot:** 1 share  
**Price Range:** 6-8 AED typically  
**Liquidity:** EXCELLENT ✓  

### 4. DP World (DP World)
**Full Name:** DP World Limited  
**Sector:** Logistics/Ports  
**Avg Daily Volume:** 5-15M shares  
**Bid-Ask Spread:** 2.0-3.0 fils (wider)  
**Tick Size:** 1.0 fils  
**Min Lot:** 1 share  
**Price Range:** 30-40 AED typically  
**Liquidity:** GOOD ✓  

**Why These 4?**
- Highest trading volume (tight spreads)
- Most liquid (can exit quickly)
- Diverse sectors (banking, real estate, logistics)
- Stable price action (less volatile than micro-caps)

**Action:** Before every trade, check: `if symbol NOT in [ENBD, ADIB, Emaar, DPW], BLOCK trade`

---

## MARKET MICROSTRUCTURE

### Settlement Cycle
**Type:** T+2 (Trade + 2 business days)  
**Meaning:** Sell today, cash received in 2 days  
**Implication:** Cannot re-use cash from a sale same-day  
**For Us:** Not applicable (all positions closed same day)

### Daily Settlement Times
**Trading:** 10:00-15:00  
**Clearing:** 15:00-16:00  
**Settlement:** End of day 2  

### Order Types Allowed
- ✓ Market orders (buy/sell at current price)
- ✓ Limit orders (buy/sell at specific price)
- ✓ Stop-loss orders (sell at lower price)
- ✓ Take-profit orders (sell at higher price)
- ✗ Short selling (NOT ALLOWED)
- ✗ Margin trading (NOT ALLOWED)
- ✗ Options (NOT ALLOWED)

---

## TICK SIZES & SPREADS

### ENBD
- Current Price: ~9.50 AED
- Tick Size: 0.5 fils (0.005)
- Min Move: 0.005 = 0.05% move
- Typical Spread: 0.5-1.0 fils = 0.05-0.1%

### ADIB
- Current Price: ~5.80 AED
- Tick Size: 1.0 fils (0.01)
- Min Move: 0.01 = 0.17% move
- Typical Spread: 1.0-2.0 fils = 0.17-0.35%

### Emaar
- Current Price: ~7.20 AED
- Tick Size: 0.5 fils (0.005)
- Min Move: 0.005 = 0.07% move
- Typical Spread: 0.5-1.5 fils = 0.07-0.21%

### DP World
- Current Price: ~35.00 AED
- Tick Size: 1.0 fils (0.01)
- Min Move: 0.01 = 0.03% move
- Typical Spread: 2.0-3.0 fils = 0.06-0.09%

---

## RESTRICTIONS (HARD LIMITS)

### No Shorting
- Cannot sell shares we don't own
- Cannot profit from price declines
- Only BUY and hold, or CLOSE position
- This limits strategy to long-only

### No Margin Trading
- Cannot borrow to buy
- Cannot leverage our $100
- Must use only available cash
- Max position size = $100

### No After-Hours Trading
- No pre-market 09:30-10:00
- No post-market 15:00+
- Violators = automatic block

### No Options/Derivatives
- Cannot trade puts/calls
- Cannot trade futures
- Cannot trade contracts for difference (CFDs)
- Stick to spot stock trading only

---

## VOLUME REQUIREMENTS

**Minimum Daily Volume:** 100,000 shares/day

All 4 approved stocks easily exceed this:
- Emaar: 30-50M shares/day ✓
- ENBD: 15-25M shares/day ✓
- ADIB: 10-20M shares/day ✓
- DP World: 5-15M shares/day ✓

**Action:** If volume falls < 100k shares in a day, reduce position size by 50%

---

## HALT MONITORING

**What is a Halt?** Exchange suspends trading for news/events  
**Duration:** 15-30 minutes typically  
**Risk:** Cannot exit position during halt  

**Halts at DFM are rare but check before trading:**
1. Before market open: Check halt list
2. Set price alerts: If stock halts, alert us
3. If halted while holding: Wait for re-open

**Action:** Check halt list every day 09:30 before market open

**Halt Check URL:** dfm.ae (DFM website, news section)

---

## SETTLEMENT & CASH FLOW

### If We Sell Today (Day T)
- T: Sell order executed, shares leave account
- T+1: Payment processing
- T+2: Cash available for withdrawal

**Implication:** 
- Can't use sale proceeds to buy same day
- For us: All trades close same day, so no issue
- Cash resets daily to $100 (paper trading mode)

### If We Hold Overnight
- T: Buy and hold
- T+1: Shares still held (waiting exit signal)
- T+2: Settlement completes
- T+3: Can sell

---

## EXCHANGE HOLIDAYS

**Check before trading:**
- Is today DFM open?
- Are related markets open (London, NY)?
- Any major news events?

**2026 Key Dates:**
- Eid holidays: April, June (multiple days each)
- Prophet's Birthday: September
- National Day: December 2-3

**Action:** Maintain holiday calendar in trading log

---

## MONITORING REQUIREMENTS

### Before Every Trade
- [ ] Check time: 10:00-15:00 GST?
- [ ] Check symbol: ENBD/ADIB/Emaar/DPW only?
- [ ] Check volume: > 100k shares/day?
- [ ] Check halts: Not halted?
- [ ] Check holiday: Market open?

### Daily (09:00 Dubai)
- [ ] Check halt list
- [ ] Verify volume normal
- [ ] Confirm market opening

### Weekly (Friday close)
- [ ] Review spread changes
- [ ] Note any volume anomalies
- [ ] Plan for holidays

---

**CORE RULE:** DFM is a small, liquid market. These constraints keep us trading the most predictable, liquid stocks.

**REMEMBER:** Trying to trade illiquid stocks = slippage + spread losses = profit killer.

Stick to the 4. Always.
