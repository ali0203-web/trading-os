# PAPER TRADING VALIDATION PLAN
**Duration:** 4 trading days (Mon-Thu)  
**Target:** 20+ paper trades with >50% win rate  
**Capital:** $100 simulated  

---

## DAY 1: Signal Generation & Hook Validation

### Pre-Market Checklist (09:30 Dubai)
- [ ] Supabase connected (verify /api/trades returns empty array)
- [ ] Market Data MCP responding (technical indicators loading)
- [ ] Halt monitoring active (fetch DFM halt list)
- [ ] Settings loaded correctly (brain files accessible)

### Trading Hours (10:00-15:00 Dubai)
**Goals:**
- Generate at least 4 signals (1+ per stock)
- Verify confidence scoring formula
- Test pre-approval hook logic

**Expected Signals:**
- Volume Surge (ENBD or Emaar) - 70-80% confidence
- MACD Crossover (any stock) - 65-75% confidence
- RSI Oversold (ADIB or Emaar) - 60-70% confidence

**Hook Validation:**
- [ ] >75% confidence signals → AUTO_EXECUTE (no delay)
- [ ] 55-75% confidence signals → ALERT (5-min popup)
- [ ] <55% confidence signals → BLOCK (logged)

### Post-Market (15:05 Dubai)
- [ ] Daily risk reset hook triggered (positions closed)
- [ ] Daily P&L calculated correctly
- [ ] No trades over $2 risk (2% rule)
- [ ] No daily loss >$5

### Metrics to Log
```
Day 1 Summary:
- Signals Generated: ___ (target: 4+)
- Signals Executed: ___ 
- Signals Alerted: ___
- Signals Blocked: ___
- Total Trades: ___
- Win Rate: ___% (target: 50%+)
- Daily P&L: $___
- Max Drawdown: ___
```

---

## DAY 2: Position Management & Risk Limits

**Goals:**
- Execute 5-6 paper trades
- Verify position sizing (Kelly formula)
- Test stop-loss enforcement

**Position Sizing Checks:**
- [ ] Volume Surge: 35 shares of Emaar (risk $5)
- [ ] MACD: 13 shares of ENBD (risk $2.50)
- [ ] RSI: 21 shares of ADIB (risk $2.50)
- [ ] Mean Reversion: 2 shares of DP World (risk $1.25)

**Stop-Loss Enforcement:**
- [ ] All positions have 2% stop loss
- [ ] All positions have 3% take profit
- [ ] Emergency stop-loss hook monitoring (10-sec intervals)

**Risk Tracking:**
- [ ] Daily loss limit respected ($5 max)
- [ ] No more than 5 trades/day
- [ ] No single trade risks >$2

**Day 2 Metrics:**
```
- Trades Executed: ___ (target: 5-6)
- Avg Position Size Accuracy: ___% (target: 95%+)
- Stops Hit: ___ (should match exit_reason='STOP_LOSS')
- Take Profits Hit: ___ (should match exit_reason='TAKE_PROFIT')
- Daily P&L: $___
- Cumulative P&L: $___
```

---

## DAY 3: Learning & Signal Accuracy

**Goals:**
- 6-8 more trades
- Analyze which signals are most accurate
- Update brain files with learnings

**Signal Accuracy Analysis:**
- [ ] Volume Surge win rate: ___% (target: >70%)
- [ ] MACD win rate: ___% (target: >65%)
- [ ] RSI win rate: ___% (target: >60%)
- [ ] Mean Reversion win rate: ___% (target: >55%)

**Confidence Scoring Review:**
- [ ] High-confidence signals (>75%) win rate: ___% (target: >80%)
- [ ] Medium-confidence signals (55-75%) win rate: ___% (target: >60%)
- [ ] Low-confidence signals (<55%) status: BLOCKED ✓

**Brain File Updates:**
- [ ] Document any new signal patterns observed
- [ ] Update confidence formulas if needed
- [ ] Log market conditions (trending/range-bound)

**Day 3 Metrics:**
```
- Cumulative Trades: ___ (target: 15+)
- Overall Win Rate: ___% (target: 50%+)
- Profit Factor (wins/losses): ___ (target: >1.5)
- Max Drawdown: ___$ (target: <$5)
- Signal Accuracy Improvement: ___% vs Day 1
```

---

## DAY 4: Final Validation & Go/No-Go Decision

**Goals:**
- Execute final 3-5 trades to reach 20+ total
- Verify all systems stable
- Make go/no-go decision for live trading

**Final Validation Checklist:**
- [ ] Total trades ≥20
- [ ] Win rate ≥50%
- [ ] Max drawdown ≤$5
- [ ] Profit factor >1.5
- [ ] All risk limits never violated
- [ ] Dashboard updates in real-time
- [ ] No unexplained errors in logs

**System Stability Checks:**
- [ ] API uptime: 100%
- [ ] Database writes: 100% success
- [ ] Hook validations: 100% executed
- [ ] Signal generation: consistent

**Go/No-Go Decision:**
```
PASS CRITERIA (must have ALL):
✓ Win rate ≥50%
✓ Max drawdown ≤$5
✓ All 20+ trades profitable/neutral (no catastrophic loss)
✓ All risk rules enforced perfectly
✓ Dashboard functional
✓ Signal generation stable

GO → Proceed to live trading
NO-GO → Review failures, adjust brain files, retry paper trading
```

---

## PAPER TRADING COMMAND

**To Start Paper Trading Session:**

```bash
cd "trading-os"
# Ensure paper_trading: true in .claude/settings.json
# Run daily at 09:55 Dubai (5 min before market open)
node mcp-servers/market-data-mcp/server.js
```

**Monitoring During Trading:**

1. **Real-time Signal Check** (every hour)
   ```bash
   curl http://localhost:3000/api/trades?limit=10
   ```

2. **P&L Check** (hourly)
   ```bash
   curl http://localhost:3000/api/performance?date=2026-09-28
   ```

3. **Risk Check** (every 30 min)
   ```bash
   Daily loss vs $5 limit
   Weekly loss vs $15 limit
   ```

**Daily Report Template:**

```
═══════════════════════════════════════
PAPER TRADING DAILY REPORT
═══════════════════════════════════════
Date: ___________
Trading Day: Day __ of 4

TRADES EXECUTED:
- Signal Type / Stock / Entry / Exit / P&L / Status

DAILY P&L: $______
CUMULATIVE P&L: $______
DAILY WIN RATE: ____%
CUMULATIVE WIN RATE: ____%
MAX DRAWDOWN: $______

ALERTS/ISSUES:
- [list any problems encountered]

BRAIN FILE UPDATES:
- [any learnings to update TRADING.md, etc.]

STATUS: ON TRACK / NEEDS REVIEW
═══════════════════════════════════════
```

---

## SUCCESS CRITERIA FOR LIVE LAUNCH

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Total Paper Trades | 20+ | __ | ✓/✗ |
| Win Rate | ≥50% | ___% | ✓/✗ |
| Profit Factor | >1.5 | ___ | ✓/✗ |
| Max Drawdown | ≤$5 | $__ | ✓/✗ |
| Risk Rules Violations | 0 | __ | ✓/✗ |
| API Uptime | 100% | ___% | ✓/✗ |
| Dashboard Functional | Yes | __ | ✓/✗ |

**FINAL DECISION:** 
- [ ] PASS → Proceed to live trading
- [ ] FAIL → Review issues, retry paper trading

---

## NEXT: LIVE TRADING DEPLOYMENT

When paper trading validates successfully:

1. **Create Arqam Capital Account** (user: 15 min)
   - Visit arqam.capital
   - Sign up (email verification)
   - Complete KYC
   - Get API credentials

2. **Fund Account** (user: fund $100)
   - Deposit $100 via bank transfer or card
   - Wait for settlement (typically 1-2 business days)

3. **Configure Live** (1 min)
   - Update .env with live ARQAM credentials
   - Set paper_trading: false in settings.json
   - Deploy to Vercel

4. **Monitor First 10 Trades** (user: active)
   - Watch each trade in real-time
   - Verify P&L calculations
   - No autopilot until confidence built

5. **Scale Gradually** (ongoing)
   - Week 1-2: $100 account, max $2/trade
   - Week 3+: Only if consistent profitability
   - Monthly review of brain files + learnings
