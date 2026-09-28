import { useState, useCallback, useEffect } from 'react'
import RFQNotificationService from '../services/rfqNotificationService.js'

export function useRFQNotifications() {
  const [discordConnected, setDiscordConnected] = useState(false)
  const [notificationStatus, setNotificationStatus] = useState('idle')
  const [campaignActive, setCampaignActive] = useState(false)
  const [campaignData, setCampaignData] = useState(null)
  const [discordGuilds, setDiscordGuilds] = useState([])
  const [selectedGuilds, setSelectedGuilds] = useState([])

  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID
  const redirectUri = import.meta.env.VITE_DISCORD_REDIRECT_URI
  const notificationService = new RFQNotificationService(clientId, redirectUri)

  // Initialize Discord connection
  const initializeDiscord = useCallback(async (discordAccessToken) => {
    try {
      await notificationService.setAccessToken(discordAccessToken)
      const guilds = await notificationService.loadUserGuilds(discordAccessToken)
      setDiscordGuilds(guilds)
      setDiscordConnected(true)
      return { success: true, guilds }
    } catch (error) {
      console.error('Failed to initialize Discord:', error)
      return { success: false, error: error.message }
    }
  }, [])

  // Start RFQ campaign
  const startCampaign = useCallback(async (campaign) => {
    try {
      setNotificationStatus('campaign_starting')

      const campaignWithGuilds = {
        ...campaign,
        guildIds: selectedGuilds.map(g => g.id)
      }

      const result = await notificationService.notifyRFQCampaignStarted(campaignWithGuilds)

      if (result.success) {
        setCampaignActive(true)
        setCampaignData(campaignWithGuilds)
        setNotificationStatus('campaign_active')
      }

      return result
    } catch (error) {
      setNotificationStatus('error')
      return { success: false, error: error.message }
    }
  }, [selectedGuilds])

  // Notify RFQ execution
  const notifyExecution = useCallback(async (executionData) => {
    try {
      setNotificationStatus('executing')

      const notificationData = {
        ...executionData,
        guildIds: selectedGuilds.map(g => g.id)
      }

      const result = await notificationService.notifyRFQExecution(notificationData)
      return result
    } catch (error) {
      return { success: false, error: error.message }
    }
  }, [selectedGuilds])

  // Notify quotes received
  const notifyQuotesReceived = useCallback(async (quoteData) => {
    try {
      const notificationData = {
        ...quoteData,
        guildIds: selectedGuilds.map(g => g.id)
      }

      const result = await notificationService.notifyQuotesReceived(notificationData)
      return result
    } catch (error) {
      return { success: false, error: error.message }
    }
  }, [selectedGuilds])

  // Notify execution complete
  const notifyExecutionComplete = useCallback(async (completionData) => {
    try {
      setNotificationStatus('completed')

      const notificationData = {
        ...completionData,
        guildIds: selectedGuilds.map(g => g.id)
      }

      const result = await notificationService.notifyExecutionComplete(notificationData)

      if (result.success) {
        setCampaignActive(false)
      }

      return result
    } catch (error) {
      return { success: false, error: error.message }
    }
  }, [selectedGuilds])

  // Notify delayed response
  const notifyDelayedResponse = useCallback(async (delayData) => {
    try {
      const notificationData = {
        ...delayData,
        guildIds: selectedGuilds.map(g => g.id)
      }

      const result = await notificationService.notifyDelayedResponse(notificationData)
      return result
    } catch (error) {
      return { success: false, error: error.message }
    }
  }, [selectedGuilds])

  // Notify critical error
  const notifyError = useCallback(async (errorData) => {
    try {
      const notificationData = {
        ...errorData,
        guildIds: selectedGuilds.map(g => g.id)
      }

      const result = await notificationService.notifyError(notificationData)
      return result
    } catch (error) {
      return { success: false, error: error.message }
    }
  }, [selectedGuilds])

  // End campaign
  const endCampaign = useCallback(() => {
    setCampaignActive(false)
    setCampaignData(null)
    setNotificationStatus('idle')
  }, [])

  return {
    // State
    discordConnected,
    notificationStatus,
    campaignActive,
    campaignData,
    discordGuilds,
    selectedGuilds,

    // Actions
    initializeDiscord,
    startCampaign,
    notifyExecution,
    notifyQuotesReceived,
    notifyExecutionComplete,
    notifyDelayedResponse,
    notifyError,
    endCampaign,
    setSelectedGuilds
  }
}
