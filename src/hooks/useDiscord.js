import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import DiscordClient from '../services/discordClient'

/**
 * React hook for Discord OAuth integration
 * Manages Discord account connection, token refresh, and data fetching
 */
export function useDiscord() {
  const [user, setUser] = useState(null)
  const [discordUser, setDiscordUser] = useState(null)
  const [guilds, setGuilds] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isConnected, setIsConnected] = useState(false)

  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID
  const redirectUri = import.meta.env.VITE_DISCORD_REDIRECT_URI

  // Initialize Discord client
  const client = new DiscordClient(clientId, redirectUri)

  // Check if Discord is already connected
  const checkConnection = useCallback(async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) return

      setUser(currentUser)

      const { data: account } = await supabase
        .from('discord_accounts')
        .select('*')
        .eq('user_id', currentUser.id)
        .single()

      if (account) {
        setIsConnected(true)
        // Token is still valid, fetch user data
        if (new Date(account.token_expires_at) > new Date()) {
          const userData = await client.getCurrentUser(account.access_token)
          setDiscordUser(userData)
          const userGuilds = await client.getUserGuilds(account.access_token)
          setGuilds(userGuilds)
        }
      } else {
        setIsConnected(false)
      }
    } catch (err) {
      console.error('Error checking Discord connection:', err)
      setError(err.message)
    }
  }, [])

  // Load connection status on mount
  useEffect(() => {
    checkConnection()
  }, [checkConnection])

  // Start OAuth flow
  const startAuth = useCallback(() => {
    setLoading(true)
    setError(null)
    const state = Math.random().toString(36).substring(7)
    // Store state in sessionStorage for callback verification
    sessionStorage.setItem('discord_oauth_state', state)
    const authUrl = client.getAuthorizationUrl(state)
    window.location.href = authUrl
  }, [])

  // Handle OAuth callback
  const handleCallback = useCallback(async (code, state) => {
    try {
      setLoading(true)
      setError(null)

      // Verify state
      const savedState = sessionStorage.getItem('discord_oauth_state')
      if (state !== savedState) {
        throw new Error('Invalid state parameter')
      }

      // Exchange code for token
      const tokenData = await client.exchangeCodeForToken(code, state)

      // Get Discord user info
      const discordUserData = await client.getCurrentUser(tokenData.access_token)
      const userGuilds = await client.getUserGuilds(tokenData.access_token)

      // Get current Supabase user
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) throw new Error('Not authenticated')

      // Save to Supabase
      await supabase.from('discord_accounts').upsert({
        user_id: currentUser.id,
        discord_id: discordUserData.id,
        discord_username: discordUserData.username,
        discord_email: discordUserData.email,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        guild_count: userGuilds.length,
        linked_at: new Date().toISOString(),
      })

      setUser(currentUser)
      setDiscordUser(discordUserData)
      setGuilds(userGuilds)
      setIsConnected(true)

      // Clear state
      sessionStorage.removeItem('discord_oauth_state')

      return { success: true, user: discordUserData }
    } catch (err) {
      console.error('OAuth callback error:', err)
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [])

  // Disconnect Discord
  const disconnect = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        await supabase
          .from('discord_accounts')
          .delete()
          .eq('user_id', currentUser.id)
      }
      setIsConnected(false)
      setDiscordUser(null)
      setGuilds([])
    } catch (err) {
      console.error('Disconnect error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch guild messages
  const fetchMessages = useCallback(async (channelId, limit = 10) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) throw new Error('Not authenticated')

      const { data: account } = await supabase
        .from('discord_accounts')
        .select('access_token')
        .eq('user_id', currentUser.id)
        .single()

      if (!account) throw new Error('Discord not connected')

      return await client.getChannelMessages(channelId, limit, account.access_token)
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  // Send message
  const sendMessage = useCallback(async (channelId, content) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) throw new Error('Not authenticated')

      const { data: account } = await supabase
        .from('discord_accounts')
        .select('access_token')
        .eq('user_id', currentUser.id)
        .single()

      if (!account) throw new Error('Discord not connected')

      return await client.sendMessage(channelId, { content }, account.access_token)
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  return {
    user,
    discordUser,
    guilds,
    loading,
    error,
    isConnected,
    startAuth,
    handleCallback,
    disconnect,
    fetchMessages,
    sendMessage,
    checkConnection,
  }
}

export default useDiscord
