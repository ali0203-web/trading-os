/**
 * RFQ Notification Service
 * Integrates Discord messaging for RFQ campaign notifications
 */

import { DiscordClient } from './discordClient.js'

class RFQNotificationService {
  constructor(discordClientId, discordRedirectUri) {
    this.discord = new DiscordClient(discordClientId, discordRedirectUri)
    this.accessToken = null
    this.userGuilds = []
  }

  async setAccessToken(token) {
    this.accessToken = token
  }

  async loadUserGuilds(token) {
    try {
      const guilds = await this.discord.getUserGuilds(token)
      this.userGuilds = guilds || []
      return this.userGuilds
    } catch (error) {
      console.error('Error loading user guilds:', error)
      return []
    }
  }

  // Send RFQ campaign started notification
  async notifyRFQCampaignStarted(campaignData) {
    if (!this.accessToken) {
      console.warn('Discord token not available, skipping notification')
      return
    }

    try {
      const message = `
📢 **RFQ Campaign Started**
━━━━━━━━━━━━━━━━━━━━━━━━━
**Campaign:** ${campaignData.name}
**Group:** ${campaignData.group}
**Time:** ${new Date().toISOString()}
**Status:** ✅ ACTIVE

⏰ **Next Action:** GROUP 1 execution at 07:50 Dubai Time
      `

      await this.sendDMToUser(message)
      await this.broadcastToGuilds(message, campaignData.guildIds)

      return { success: true, message: 'Campaign started notification sent' }
    } catch (error) {
      console.error('Error sending campaign started notification:', error)
      return { success: false, error: error.message }
    }
  }

  // Send RFQ execution notification
  async notifyRFQExecution(executionData) {
    if (!this.accessToken) return

    try {
      const message = `
⚡ **RFQ Execution - GROUP ${executionData.group}**
━━━━━━━━━━━━━━━━━━━━━━━━━
**Quote Requests:** ${executionData.quoteCount}
**Execution Time:** ${executionData.timestamp}
**Participants:** ${executionData.participantCount}
**Status:** ${executionData.status}

📊 **Expected Response Time:** ${executionData.expectedResponseTime} minutes
      `

      await this.sendDMToUser(message)
      await this.broadcastToGuilds(message, executionData.guildIds)

      return { success: true, message: 'Execution notification sent' }
    } catch (error) {
      console.error('Error sending execution notification:', error)
      return { success: false, error: error.message }
    }
  }

  // Send RFQ quotes received notification
  async notifyQuotesReceived(quoteData) {
    if (!this.accessToken) return

    try {
      const bestQuote = quoteData.quotes.sort((a, b) => b.score - a.score)[0]

      const message = `
✅ **RFQ Quotes Received**
━━━━━━━━━━━━━━━━━━━━━━━━━
**Total Quotes:** ${quoteData.quotes.length}
**Reception Time:** ${quoteData.receptionTime}

🏆 **Best Quote:**
  • Provider: ${bestQuote.provider}
  • Price: ${bestQuote.price}
  • Score: ${bestQuote.score}
  • Terms: ${bestQuote.terms}

⏳ **Next Step:** Execution scheduled for ${quoteData.nextStep}
      `

      await this.sendDMToUser(message)
      await this.broadcastToGuilds(message, quoteData.guildIds)

      return { success: true, message: 'Quotes received notification sent' }
    } catch (error) {
      console.error('Error sending quotes received notification:', error)
      return { success: false, error: error.message }
    }
  }

  // Send execution completion notification
  async notifyExecutionComplete(completionData) {
    if (!this.accessToken) return

    try {
      const message = `
🎯 **RFQ Execution Complete**
━━━━━━━━━━━━━━━━━━━━━━━━━
**Campaign:** ${completionData.campaignName}
**Execution Time:** ${completionData.executionTime}
**Total Volume:** ${completionData.totalVolume}

📈 **Results:**
  • Executed Quotes: ${completionData.executedQuotes}
  • Total Value: ${completionData.totalValue}
  • Average Price: ${completionData.avgPrice}
  • Success Rate: ${completionData.successRate}%

✨ **Status:** COMPLETED SUCCESSFULLY
      `

      await this.sendDMToUser(message)
      await this.broadcastToGuilds(message, completionData.guildIds)

      return { success: true, message: 'Completion notification sent' }
    } catch (error) {
      console.error('Error sending completion notification:', error)
      return { success: false, error: error.message }
    }
  }

  // Send alert for delayed responses
  async notifyDelayedResponse(delayData) {
    if (!this.accessToken) return

    try {
      const message = `
⚠️ **Quote Response Delayed**
━━━━━━━━━━━━━━━━━━━━━━━━━
**Provider:** ${delayData.provider}
**Expected:** ${delayData.expectedTime}
**Delay:** ${delayData.delayMinutes} minutes
**Action Required:** ${delayData.action}

🔔 **Escalation Level:** ${delayData.escalationLevel}
      `

      await this.sendDMToUser(message)
      await this.broadcastToGuilds(message, delayData.guildIds)

      return { success: true, message: 'Delay alert sent' }
    } catch (error) {
      console.error('Error sending delay notification:', error)
      return { success: false, error: error.message }
    }
  }

  // Send error/critical notification
  async notifyError(errorData) {
    if (!this.accessToken) return

    try {
      const message = `
🚨 **CRITICAL ALERT - RFQ Error**
━━━━━━━━━━━━━━━━━━━━━━━━━
**Error Type:** ${errorData.errorType}
**Timestamp:** ${new Date().toISOString()}
**Details:** ${errorData.details}
**Action Required:** IMMEDIATE

📞 **Contact:** ${errorData.contactPerson}
☎️ **Phone:** ${errorData.contactPhone}
      `

      await this.sendDMToUser(message)
      await this.broadcastToGuilds(message, errorData.guildIds)

      return { success: true, message: 'Error notification sent' }
    } catch (error) {
      console.error('Error sending error notification:', error)
      return { success: false, error: error.message }
    }
  }

  // Send DM to current user
  async sendDMToUser(message) {
    try {
      const user = await this.discord.getCurrentUser(this.accessToken)
      if (user) {
        return await this.discord.sendMessage(this.accessToken, user.id, message)
      }
    } catch (error) {
      console.error('Error sending DM:', error)
    }
  }

  // Broadcast message to multiple guilds/channels
  async broadcastToGuilds(message, guildIds = []) {
    if (!guildIds || guildIds.length === 0) return

    const results = []
    for (const guildId of guildIds) {
      try {
        const result = await this.discord.sendMessage(
          this.accessToken,
          guildId,
          message
        )
        results.push({ guildId, success: true, result })
      } catch (error) {
        results.push({ guildId, success: false, error: error.message })
      }
    }
    return results
  }

  // Get notification status
  getStatus() {
    return {
      connected: !!this.accessToken,
      guilds: this.userGuilds.length,
      ready: !!this.accessToken && this.userGuilds.length > 0
    }
  }
}

export default RFQNotificationService
