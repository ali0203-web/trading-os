/**
 * Discord OAuth Client for Vite/React
 * Client-side OAuth flow with Supabase token storage
 */

const DISCORD_API = 'https://discord.com/api/v10'
const DISCORD_OAUTH = 'https://discord.com'

export class DiscordClient {
  constructor(clientId, redirectUri) {
    this.clientId = clientId
    this.redirectUri = redirectUri
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state, scopes = ['identify', 'email', 'guilds']) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      state,
      redirect_uri: this.redirectUri,
      scope: scopes.join(' '),
    })
    return `${DISCORD_OAUTH}/oauth2/authorize?${params}`
  }

  /**
   * Exchange authorization code for tokens
   * Calls backend proxy to securely exchange code
   */
  async exchangeCodeForToken(code, state) {
    const response = await fetch('/api/discord/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Token exchange failed')
    }

    return response.json()
  }

  /**
   * Fetch Discord user data using access token
   */
  async getCurrentUser(accessToken) {
    const response = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) throw new Error('Failed to fetch user')
    return response.json()
  }

  /**
   * Get user's Discord servers/guilds
   */
  async getUserGuilds(accessToken) {
    const response = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) throw new Error('Failed to fetch guilds')
    return response.json()
  }

  /**
   * Send message to Discord channel
   */
  async sendMessage(channelId, message, accessToken) {
    const response = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    })

    if (!response.ok) throw new Error('Failed to send message')
    return response.json()
  }

  /**
   * Get channel messages
   */
  async getChannelMessages(channelId, limit = 10, accessToken) {
    const response = await fetch(
      `${DISCORD_API}/channels/${channelId}/messages?limit=${limit}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (!response.ok) throw new Error('Failed to fetch messages')
    return response.json()
  }

  /**
   * Get channel details
   */
  async getChannel(channelId, accessToken) {
    const response = await fetch(`${DISCORD_API}/channels/${channelId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) throw new Error('Failed to fetch channel')
    return response.json()
  }

  /**
   * Get guild details
   */
  async getGuild(guildId, accessToken) {
    const response = await fetch(`${DISCORD_API}/guilds/${guildId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) throw new Error('Failed to fetch guild')
    return response.json()
  }

  /**
   * Get guild channels
   */
  async getGuildChannels(guildId, accessToken) {
    const response = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) throw new Error('Failed to fetch channels')
    return response.json()
  }
}

export default DiscordClient
