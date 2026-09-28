import React, { useState, useEffect } from 'react'
import { useRFQNotifications } from '../hooks/useRFQNotifications.js'
import { useDiscord } from '../hooks/useDiscord.js'

export default function RFQCampaign() {
  const { discordUser, isConnected } = useDiscord()
  const {
    discordConnected,
    notificationStatus,
    campaignActive,
    discordGuilds,
    selectedGuilds,
    initializeDiscord,
    startCampaign,
    notifyExecution,
    notifyQuotesReceived,
    notifyExecutionComplete,
    notifyDelayedResponse,
    notifyError,
    endCampaign,
    setSelectedGuilds
  } = useRFQNotifications()

  const [campaignForm, setCampaignForm] = useState({
    name: '',
    group: 'GROUP_1',
    quoteCount: 5,
    executionTime: '07:50'
  })

  const [executionData, setExecutionData] = useState(null)
  const [campaignStatus, setCampaignStatus] = useState('idle')

  // Initialize Discord when user connects
  useEffect(() => {
    if (isConnected && discordUser && !discordConnected) {
      const token = localStorage.getItem('discord_access_token')
      if (token) {
        initializeDiscord(token)
      }
    }
  }, [isConnected, discordUser, discordConnected, initializeDiscord])

  const handleStartCampaign = async (e) => {
    e.preventDefault()

    if (!discordConnected) {
      alert('Please connect to Discord first')
      return
    }

    if (selectedGuilds.length === 0) {
      alert('Please select at least one Discord server')
      return
    }

    const result = await startCampaign({
      name: campaignForm.name,
      group: campaignForm.group,
      quoteCount: campaignForm.quoteCount,
      executionTime: campaignForm.executionTime,
      timestamp: new Date().toISOString()
    })

    if (result.success) {
      setCampaignStatus('active')
      alert('Campaign started! Discord notifications sent.')
    } else {
      alert(`Error: ${result.error}`)
    }
  }

  const handleExecutionPhase = async () => {
    const execData = {
      group: campaignForm.group,
      quoteCount: campaignForm.quoteCount,
      timestamp: new Date().toLocaleTimeString('en-AE', { timeZone: 'Asia/Dubai' }),
      participantCount: Math.floor(Math.random() * 10) + 3,
      status: 'IN_PROGRESS',
      expectedResponseTime: 15
    }

    const result = await notifyExecution(execData)

    if (result.success) {
      setExecutionData(execData)
      setCampaignStatus('executing')
      alert('Execution notification sent!')
    }
  }

  const handleQuotesReceived = async () => {
    const quotes = [
      { provider: 'Provider A', price: 100.5, score: 95, terms: '2/10, net 30' },
      { provider: 'Provider B', price: 102.0, score: 88, terms: 'net 30' },
      { provider: 'Provider C', price: 99.8, score: 98, terms: 'net 45' }
    ]

    const result = await notifyQuotesReceived({
      quotes,
      receptionTime: new Date().toLocaleTimeString('en-AE', { timeZone: 'Asia/Dubai' }),
      nextStep: new Date(Date.now() + 30 * 60000).toLocaleTimeString('en-AE', { timeZone: 'Asia/Dubai' })
    })

    if (result.success) {
      setCampaignStatus('quotes_received')
      alert('Quotes received notification sent!')
    }
  }

  const handleCompleteExecution = async () => {
    const result = await notifyExecutionComplete({
      campaignName: campaignForm.name,
      executionTime: new Date().toLocaleTimeString('en-AE', { timeZone: 'Asia/Dubai' }),
      totalVolume: '$500,000',
      executedQuotes: 3,
      totalValue: '$498,750',
      avgPrice: 100.45,
      successRate: 100
    })

    if (result.success) {
      setCampaignStatus('completed')
      endCampaign()
      alert('Campaign completed! Final notification sent.')
    }
  }

  const toggleGuildSelection = (guild) => {
    if (selectedGuilds.find(g => g.id === guild.id)) {
      setSelectedGuilds(selectedGuilds.filter(g => g.id !== guild.id))
    } else {
      setSelectedGuilds([...selectedGuilds, guild])
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      idle: '#808080',
      active: '#27ae60',
      executing: '#f39c12',
      quotes_received: '#3498db',
      completed: '#9b59b6'
    }
    return colors[status] || '#808080'
  }

  return (
    <div style={{ padding: '2rem', background: '#0a0e1a', color: 'white', minHeight: '100vh' }}>
      <h1 style={{ marginBottom: '2rem', fontSize: '2rem' }}>📊 RFQ Campaign Manager</h1>

      {/* Discord Connection Status */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        padding: '1.5rem',
        borderRadius: '8px',
        marginBottom: '2rem',
        border: `2px solid ${discordConnected ? '#27ae60' : '#e74c3c'}`
      }}>
        <h2>🔗 Discord Connection</h2>
        <p>Status: <strong style={{ color: discordConnected ? '#27ae60' : '#e74c3c' }}>
          {discordConnected ? '✅ Connected' : '❌ Not Connected'}
        </strong></p>
        {discordConnected && discordUser && (
          <p>Connected as: <strong>{discordUser.username}</strong></p>
        )}
        {discordConnected && (
          <div style={{ marginTop: '1rem' }}>
            <h3>Select Discord Servers for Notifications:</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              {discordGuilds.map(guild => (
                <label key={guild.id} style={{
                  padding: '1rem',
                  background: selectedGuilds.find(g => g.id === guild.id) ? 'rgba(39, 174, 96, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  border: selectedGuilds.find(g => g.id === guild.id) ? '2px solid #27ae60' : '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <input
                    type="checkbox"
                    checked={!!selectedGuilds.find(g => g.id === guild.id)}
                    onChange={() => toggleGuildSelection(guild)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  {guild.name}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Campaign Form */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        padding: '2rem',
        borderRadius: '8px',
        marginBottom: '2rem'
      }}>
        <h2>🎯 Start New RFQ Campaign</h2>
        <form onSubmit={handleStartCampaign} style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label>Campaign Name:</label>
            <input
              type="text"
              value={campaignForm.name}
              onChange={(e) => setCampaignForm({...campaignForm, name: e.target.value})}
              placeholder="e.g., Q4 Quarterly RFQ"
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                color: 'white',
                marginTop: '0.5rem'
              }}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label>Campaign Group:</label>
              <select
                value={campaignForm.group}
                onChange={(e) => setCampaignForm({...campaignForm, group: e.target.value})}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '4px',
                  color: 'white',
                  marginTop: '0.5rem'
                }}
              >
                <option value="GROUP_1">GROUP 1 - High Priority</option>
                <option value="GROUP_2">GROUP 2 - Standard</option>
                <option value="GROUP_3">GROUP 3 - Batch</option>
              </select>
            </div>

            <div>
              <label>Execution Time (Dubai):</label>
              <input
                type="time"
                value={campaignForm.executionTime}
                onChange={(e) => setCampaignForm({...campaignForm, executionTime: e.target.value})}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '4px',
                  color: 'white',
                  marginTop: '0.5rem'
                }}
              />
            </div>
          </div>

          <div>
            <label>Number of Quote Requests:</label>
            <input
              type="number"
              min="1"
              max="50"
              value={campaignForm.quoteCount}
              onChange={(e) => setCampaignForm({...campaignForm, quoteCount: parseInt(e.target.value)})}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                color: 'white',
                marginTop: '0.5rem'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={campaignActive || !discordConnected}
            style={{
              padding: '0.75rem 1.5rem',
              background: campaignActive || !discordConnected ? '#555' : '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: campaignActive || !discordConnected ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            {campaignActive ? '⏸️ Campaign Active' : '🚀 Start Campaign'}
          </button>
        </form>
      </div>

      {/* Campaign Status */}
      {campaignActive && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '2rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          border: `2px solid ${getStatusColor(campaignStatus)}`
        }}>
          <h2>📈 Campaign Status</h2>
          <p>Current Phase: <strong style={{ color: getStatusColor(campaignStatus) }}>
            {campaignStatus.toUpperCase().replace('_', ' ')}
          </strong></p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
            <button
              onClick={handleExecutionPhase}
              disabled={campaignStatus === 'executing' || campaignStatus === 'quotes_received' || campaignStatus === 'completed'}
              style={{
                padding: '0.75rem',
                background: campaignStatus === 'executing' ? '#f39c12' : '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ⚡ Execute RFQ
            </button>

            <button
              onClick={handleQuotesReceived}
              disabled={campaignStatus !== 'executing'}
              style={{
                padding: '0.75rem',
                background: campaignStatus === 'quotes_received' ? '#3498db' : '#555',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: campaignStatus === 'executing' ? 'pointer' : 'not-allowed',
                fontWeight: 'bold'
              }}
            >
              📊 Quotes Received
            </button>

            <button
              onClick={handleCompleteExecution}
              disabled={campaignStatus !== 'quotes_received'}
              style={{
                padding: '0.75rem',
                background: campaignStatus === 'completed' ? '#9b59b6' : '#555',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: campaignStatus === 'quotes_received' ? 'pointer' : 'not-allowed',
                fontWeight: 'bold'
              }}
            >
              ✅ Complete
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        padding: '2rem',
        borderRadius: '8px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '1rem'
      }}>
        <div>
          <h3>Discord Servers</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#27ae60' }}>
            {selectedGuilds.length}
          </p>
        </div>
        <div>
          <h3>Quote Requests</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3498db' }}>
            {campaignForm.quoteCount}
          </p>
        </div>
        <div>
          <h3>Campaign Status</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: getStatusColor(campaignStatus) }}>
            {campaignStatus.toUpperCase()}
          </p>
        </div>
      </div>
    </div>
  )
}
