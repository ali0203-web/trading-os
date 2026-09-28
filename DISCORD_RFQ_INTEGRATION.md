# 🔗 Discord + RFQ Campaign Integration Guide

## Overview

Your RFQ notification system is now fully integrated with Discord. Every step of your RFQ campaign is automatically sent to Discord servers and DMs in real-time.

---

## Architecture

```
RFQ Campaign Manager (React UI)
    ↓
useRFQNotifications Hook (State Management)
    ↓
RFQNotificationService (Business Logic)
    ↓
DiscordClient (OAuth + Discord API)
    ↓
Discord Servers + DMs (Real-time Notifications)
```

---

## Components

### 1. **RFQ Notification Service** (`src/services/rfqNotificationService.js`)
- Handles all Discord messaging for RFQ events
- Manages guild/channel communication
- Formats and sends notifications
- Error handling and fallbacks

**Key Methods:**
- `notifyRFQCampaignStarted()` - Campaign begins
- `notifyRFQExecution()` - RFQ execution starts
- `notifyQuotesReceived()` - Quotes arrive
- `notifyExecutionComplete()` - Campaign finishes
- `notifyDelayedResponse()` - Alert for delays
- `notifyError()` - Critical alerts

### 2. **useRFQNotifications Hook** (`src/hooks/useRFQNotifications.js`)
- React hook for campaign state management
- Integrates with Discord connection
- Provides campaign lifecycle methods
- Manages guild selection

**State:**
- `discordConnected` - Discord auth status
- `campaignActive` - Campaign running?
- `notificationStatus` - Current phase
- `selectedGuilds` - Target Discord servers

### 3. **RFQ Campaign Manager** (`src/pages/RFQCampaign.jsx`)
- User interface for campaign management
- Guild selection interface
- Campaign execution controls
- Real-time status display

**Features:**
- ✅ Create and start RFQ campaigns
- ✅ Select Discord servers for notifications
- ✅ Execute RFQ at specific times
- ✅ Track quote responses
- ✅ Complete campaign with final notifications

---

## How to Use

### Step 1: Connect Discord
```
1. Go to RFQ Campaign page
2. Click "Connect Discord" button
3. Authorize the Trading OS app
4. Select Discord servers to receive notifications
```

### Step 2: Create Campaign
```
1. Fill in campaign details:
   - Campaign name
   - Group (1, 2, or 3)
   - Execution time (Dubai timezone)
   - Number of quote requests
2. Select target Discord servers
3. Click "Start Campaign"
```

### Step 3: Execute RFQ
```
1. Click "⚡ Execute RFQ" button
2. Discord notifications sent automatically
3. System broadcasts to all selected servers
4. Real-time status updates
```

### Step 4: Track Quotes
```
1. Monitor incoming quotes
2. Click "📊 Quotes Received"
3. Notifications sent with best quote
4. Next steps communicated
```

### Step 5: Complete Campaign
```
1. Review execution results
2. Click "✅ Complete"
3. Final summary sent to Discord
4. Campaign archived
```

---

## Notification Types

### 1. Campaign Started
```
📢 **RFQ Campaign Started**
Campaign: Q4 Quarterly RFQ
Group: GROUP_1
Status: ✅ ACTIVE
Next Action: GROUP 1 execution at 07:50 Dubai Time
```

### 2. Execution Notification
```
⚡ **RFQ Execution - GROUP 1**
Quote Requests: 5
Execution Time: 09:45:30
Participants: 8
Status: IN_PROGRESS
Expected Response Time: 15 minutes
```

### 3. Quotes Received
```
✅ **RFQ Quotes Received**
Total Quotes: 3
Best Quote: Provider C @ 99.80 (Score: 98)
Next Step: Execution scheduled
```

### 4. Execution Complete
```
🎯 **RFQ Execution Complete**
Campaign: Q4 Quarterly RFQ
Execution Time: 09:45 AM
Total Volume: $500,000
Success Rate: 100%
```

### 5. Delayed Response Alert
```
⚠️ **Quote Response Delayed**
Provider: Provider B
Delay: 12 minutes
Action Required: Follow-up email sent
Escalation Level: MEDIUM
```

### 6. Critical Error
```
🚨 **CRITICAL ALERT - RFQ Error**
Error Type: Connection timeout
Timestamp: 2026-09-28 09:45:00
Action Required: IMMEDIATE
Contact: trading-ops@company.com
```

---

## Integration with Dubai Timezone Clock

When used with the Dubai timezone clock system:

```javascript
// Dubai time tracker automatically triggers RFQ at 08:00
// → Updates your RFQ campaign manager
// → Starts campaign at Dubai local time
// → All notifications show Dubai timezone
// → Execution tracked in Dubai time
```

---

## Discord Message Format

All messages use consistent formatting:
- **Emoji indicators** for quick scanning
- **Sections** separated by dashes (━)
- **Bold text** for important data
- **Multiple lines** for easy reading

Example:
```
📢 **Campaign Title**
━━━━━━━━━━━━━━━━━━━
**Field 1:** Value 1
**Field 2:** Value 2
Status: ✅ SUCCESS
```

---

## Security & Privacy

✅ **Discord OAuth 2.0** - Secure authentication
✅ **Token Refresh** - Automatic token lifecycle
✅ **RLS Policies** - Database access control
✅ **Guild Selection** - User chooses where to notify
✅ **No Sensitive Data** - No personal info in messages

---

## Troubleshooting

### Discord not connecting?
- Check Discord OAuth credentials in .env.local
- Verify DISCORD_REDIRECT_URI matches app settings
- Ensure Discord app is authorized

### Notifications not sending?
- Confirm Discord servers are selected
- Check bot has message permissions
- Verify Supabase token is valid

### Messages not formatted correctly?
- Check emoji support in Discord server
- Verify special characters are encoded
- Test with simple message first

---

## Example Workflow

```
9:00 AM Dubai Time
├─ Create "Q4 Quarterly RFQ" campaign
├─ Select 5 Discord servers
├─ Set execution for 07:50 Dubai time
└─ 📢 Campaign Started notification → Discord

7:50 AM Dubai Time (Next Day)
├─ Click "⚡ Execute RFQ"
├─ 5 quote requests sent
└─ ⚡ RFQ Execution notification → Discord

8:05 AM Dubai Time
├─ 3 quotes received
└─ ✅ Quotes Received notification → Discord

8:20 AM Dubai Time
├─ Review quotes, select best
├─ Click "✅ Complete"
└─ 🎯 Execution Complete notification → Discord
```

---

## Files Created

```
src/
├── services/
│   ├── discordClient.js (existing)
│   └── rfqNotificationService.js (new)
├── hooks/
│   ├── useDiscord.js (existing)
│   └── useRFQNotifications.js (new)
├── pages/
│   └── RFQCampaign.jsx (new)
└── App.jsx (updated)
```

---

## Next Steps

1. ✅ Connect Discord account to Trading OS
2. ✅ Select Discord servers for notifications
3. ✅ Create first RFQ campaign
4. ✅ Execute and track in real-time
5. ✅ Monitor completion and success rates

---

## Support

All RFQ notifications are logged to Supabase for:
- Audit trails
- Compliance reporting
- Performance tracking
- Troubleshooting

Access logs in Supabase:
```sql
SELECT * FROM discord_accounts 
WHERE user_id = current_user_id
ORDER BY updated_at DESC
```

---

**Status:** ✅ READY FOR PRODUCTION
**Integration:** Complete Discord OAuth 2.0 + RFQ Campaign Manager
**Last Updated:** 2026-09-28
