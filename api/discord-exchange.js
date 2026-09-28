/**
 * Discord Token Exchange Endpoint
 * Securely exchanges authorization code for access token
 * This is a Vercel serverless function (api/discord-exchange.js)
 * Handles CORS and environment variable security
 */

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { code, state } = req.body

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' })
    }

    const clientId = process.env.DISCORD_CLIENT_ID
    const clientSecret = process.env.DISCORD_CLIENT_SECRET
    const redirectUri = process.env.DISCORD_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(500).json({ error: 'Missing Discord configuration' })
    }

    // Exchange code for token
    const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json()
      return res.status(400).json({
        error: error.error_description || 'Token exchange failed',
      })
    }

    const tokenData = await tokenResponse.json()

    // Return token data (never expose client secret to client)
    return res.status(200).json({
      access_token: tokenData.access_token,
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      refresh_token: tokenData.refresh_token,
      scope: tokenData.scope,
    })
  } catch (error) {
    console.error('Token exchange error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
