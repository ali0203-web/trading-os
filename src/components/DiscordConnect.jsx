import { useEffect } from 'react'
import useDiscord from '../hooks/useDiscord'

/**
 * Discord Connect Component
 * Displays Discord connection status and allows connecting/disconnecting
 */
export function DiscordConnect() {
  const { isConnected, discordUser, loading, error, startAuth, disconnect, handleCallback } = useDiscord()

  // Handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')

    if (code && state) {
      handleCallback(code, state)
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [handleCallback])

  if (loading) {
    return (
      <div className="p-4 bg-indigo-50 rounded-lg">
        <p className="text-indigo-900">Connecting Discord...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg">
        <p className="text-red-900 font-semibold">Error: {error}</p>
        <button
          onClick={startAuth}
          className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (isConnected && discordUser) {
    return (
      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-900 font-semibold">✓ Discord Connected</p>
            <p className="text-green-700 text-sm">@{discordUser.username}</p>
            {discordUser.email && (
              <p className="text-green-600 text-sm">{discordUser.email}</p>
            )}
          </div>
          <button
            onClick={disconnect}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={startAuth}
      disabled={loading}
      className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-semibold flex items-center gap-2"
    >
      <span>🎮</span>
      {loading ? 'Connecting...' : 'Connect Discord Account'}
    </button>
  )
}

export default DiscordConnect
