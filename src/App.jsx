import React, { useState } from 'react'
import './App.css'
import Dashboard from './pages/Dashboard'
import Overview from './pages/Overview'
import Markets from './pages/Markets'
import Analytics from './pages/Analytics'
import RiskManagement from './pages/RiskManagement'
import Alerts from './pages/Alerts'
import News from './pages/News'
import RFQCampaign from './pages/RFQCampaign'

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')

  return (
    <div className="app-container">
      <nav className="main-nav">
        <div className="nav-logo">📈 TRADING PRO</div>
        <div className="nav-links">
          <button 
            className={`nav-btn ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentPage('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`nav-btn ${currentPage === 'overview' ? 'active' : ''}`}
            onClick={() => setCurrentPage('overview')}
          >
            Overview
          </button>
          <button 
            className={`nav-btn ${currentPage === 'markets' ? 'active' : ''}`}
            onClick={() => setCurrentPage('markets')}
          >
            Markets
          </button>
          <button 
            className={`nav-btn ${currentPage === 'analytics' ? 'active' : ''}`}
            onClick={() => setCurrentPage('analytics')}
          >
            Analytics
          </button>
          <button 
            className={`nav-btn ${currentPage === 'risk' ? 'active' : ''}`}
            onClick={() => setCurrentPage('risk')}
          >
            Risk
          </button>
          <button 
            className={`nav-btn ${currentPage === 'alerts' ? 'active' : ''}`}
            onClick={() => setCurrentPage('alerts')}
          >
            Alerts
          </button>
          <button
            className={`nav-btn ${currentPage === 'news' ? 'active' : ''}`}
            onClick={() => setCurrentPage('news')}
          >
            News
          </button>
          <button
            className={`nav-btn ${currentPage === 'rfq' ? 'active' : ''}`}
            onClick={() => setCurrentPage('rfq')}
            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          >
            📊 RFQ
          </button>
        </div>
        <div className="nav-right">
          <span>Account: gendawala1024@gmail.com</span>
          <button className="logout-btn">⚙️ Settings</button>
        </div>
      </nav>

      <div className="main-content">
        {currentPage === 'dashboard' && <Dashboard />}
        {currentPage === 'overview' && <Overview />}
        {currentPage === 'markets' && <Markets />}
        {currentPage === 'analytics' && <Analytics />}
        {currentPage === 'risk' && <RiskManagement />}
        {currentPage === 'alerts' && <Alerts />}
        {currentPage === 'news' && <News />}
        {currentPage === 'rfq' && <RFQCampaign />}
      </div>
    </div>
  )
}
