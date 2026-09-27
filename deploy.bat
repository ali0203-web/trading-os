@echo off
REM AUTOMATED RAILWAY DEPLOYMENT SCRIPT (Windows)
REM Run this once after organizing all files and it handles everything

setlocal enabledelayedexpansion

echo.
echo 🚀 AUTONOMOUS TRADING AGENTS - AUTOMATED DEPLOYMENT
echo ====================================================
echo.

REM Check if Railway CLI is installed
echo 📦 Checking Railway CLI...
railway --version >nul 2>&1
if errorlevel 1 (
    echo Railway CLI not found. Installing...
    npm install -g @railway/cli
)

REM Check if logged in
echo 🔐 Checking Railway login...
railway whoami >nul 2>&1
if errorlevel 1 (
    echo Not logged in. Opening login...
    railway login
)

REM Link to project
echo.
echo 🔗 Linking to Railway project...
railway link

REM Add PostgreSQL if not already added
echo.
echo 📊 Checking PostgreSQL...
railway service list | find /i "postgres" >nul
if errorlevel 1 (
    echo Adding PostgreSQL service...
    railway add
) else (
    echo ✅ PostgreSQL already added
)

REM Wait for PostgreSQL to initialize
echo.
echo ⏳ Waiting for PostgreSQL to initialize...
timeout /t 10 /nobreak

REM Set all environment variables
echo.
echo 🔑 Setting environment variables...

railway variables set BINANCE_TESTNET_API_KEY "oibQy50SPkGO1WQLsNmO2jrqiHmbEJBlqURlXuh0OSCzvSwTc5okcyAa22STOPm"
echo ✅ BINANCE_TESTNET_API_KEY

railway variables set BINANCE_TESTNET_SECRET_KEY "eGpKKMoW8Oh7n5qmzfNRT9E6KG3a2EFqebCK88syRuhzObwA2BEMW5laTXtQ0ZSE"
echo ✅ BINANCE_TESTNET_SECRET_KEY

REM Discord webhook - ask user for this
echo.
set /p DISCORD_URL="Enter your Discord webhook URL (from DISCORD_SETUP_QUICK.md): "
railway variables set DISCORD_WEBHOOK_URL "%DISCORD_URL%"
echo ✅ DISCORD_WEBHOOK_URL

railway variables set TRADING_MODE "TESTNET"
echo ✅ TRADING_MODE

railway variables set LOG_LEVEL "info"
echo ✅ LOG_LEVEL

railway variables set NODE_ENV "production"
echo ✅ NODE_ENV

REM Deploy application
echo.
echo Starting deployment to Railway...
echo This may take 2-3 minutes...
echo.

railway up

REM Watch logs
echo.
echo ✅ DEPLOYMENT STARTED!
echo.
echo 📡 Watching logs (press Ctrl+C to stop)...
echo 🔍 Look for: ✅ ALL AGENTS STARTED SUCCESSFULLY
echo.

railway logs --follow

pause
