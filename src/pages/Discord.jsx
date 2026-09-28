import { useState } from 'react'
import DiscordConnect from '../components/DiscordConnect'
import useDiscord from '../hooks/useDiscord'

/**
 * Discord Integration Page
 * Manage Discord connection and view connected servers
 */
export default function Discord() {
  const { isConnected, discordUser, guilds, loading, error } = useDiscord()
  const [selectedGuild, setSelectedGuild] = useState(null)

  return (
    <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Discord Integration</h1>
          <p className="text-slate-400">Connect your Discord account and manage your servers</p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Connect Section */}
          <div className="lg:col-span-1">
            <div className="bg-slate-700 rounded-lg p-6 h-full">
              <h2 className="text-xl font-semibold text-white mb-4">Account</h2>

              <div className="mb-6">
                <DiscordConnect />
              </div>

              {isConnected && discordUser && (
                <div className="space-y-3 text-sm">
                  <div className="bg-slate-600 rounded p-3">
                    <p className="text-slate-400">Username</p>
                    <p className="text-white font-semibold">{discordUser.username}</p>
                  </div>

                  {discordUser.email && (
                    <div className="bg-slate-600 rounded p-3">
                      <p className="text-slate-400">Email</p>
                      <p className="text-white">{discordUser.email}</p>
                    </div>
                  )}

                  <div className="bg-slate-600 rounded p-3">
                    <p className="text-slate-400">Servers</p>
                    <p className="text-white font-semibold">{guilds.length}</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-900 border border-red-700 rounded p-3 text-red-200 text-sm">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Servers Section */}
          {isConnected && guilds.length > 0 && (
            <div className="lg:col-span-2">
              <div className="bg-slate-700 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Your Discord Servers</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {guilds.map((guild) => (
                    <div
                      key={guild.id}
                      onClick={() => setSelectedGuild(guild)}
                      className={`p-4 rounded-lg cursor-pointer transition ${
                        selectedGuild?.id === guild.id
                          ? 'bg-indigo-600 ring-2 ring-indigo-400'
                          : 'bg-slate-600 hover:bg-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {guild.icon ? (
                          <img
                            src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                            alt={guild.name}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-500 flex items-center justify-center text-xs font-semibold text-white">
                            {guild.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-white font-semibold">{guild.name}</p>
                          {guild.owner && (
                            <span className="text-xs bg-yellow-600 px-2 py-1 rounded text-yellow-100">
                              Owner
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedGuild && (
                  <div className="mt-6 p-4 bg-slate-600 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-2">{selectedGuild.name}</h3>
                    <p className="text-slate-300 text-sm mb-3">ID: {selectedGuild.id}</p>
                    <div className="flex gap-2">
                      <a
                        href={`https://discord.com/channels/${selectedGuild.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-semibold"
                      >
                        Open in Discord
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {!isConnected && (
          <div className="bg-slate-700 rounded-lg p-6 text-center">
            <p className="text-slate-400 mb-4">Connect your Discord account to get started</p>
          </div>
        )}

        {loading && (
          <div className="text-center text-slate-400">
            <p>Loading...</p>
          </div>
        )}
      </div>
    </div>
  )
}
