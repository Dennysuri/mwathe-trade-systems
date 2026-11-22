import { useState, useRef, useEffect } from 'react'
import { Play, Square, RefreshCw, Terminal, AlertCircle, TrendingUp, Target, ShieldCheck, Zap } from 'lucide-react'
import { buildProposal, VOLATILITY_MARKETS } from '../services/tradingCore'
import { validateEntryWindow } from '../services/strategyIntelligence'
import { evaluateForwardCalibrationGate } from '../services/forwardCalibrationGate'
import { validateLiveOpportunity } from '../services/liveOpportunityEngine'
import { rankLiveStrategyUniverse } from '../services/strategyUniverse'
import { recordContractOutcome } from '../services/contractOutcomeIntelligence'
import { evaluateAccountRisk, getAdaptiveStrategyStatus, recordAdaptiveOutcome } from '../services/adaptiveTradingIntelligence'
import { advancePaperTrials, beginPaperTrial, getPaperForwardSummary, recordSettledContractOutcome, supportsForwardCalibration } from '../services/paperForwardCalibration'
import { appendTickBuffer, seedTickBuffer } from '../services/marketTickBuffer'
import { createRecoveryLedger, nextRecoveryStake, recordRecoveryOutcome } from '../services/recoveryAccounting'

const copyLogFeed = async (entries) => {
  const value = (entries || []).join('\n');
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); return true; } } catch {}
  try {
    const textarea = document.createElement('textarea'); textarea.value = value;
    textarea.setAttribute('readonly', ''); textarea.style.position = 'fixed';
    textarea.style.opacity = '0'; textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea); textarea.focus(); textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand('copy'); textarea.remove(); return copied;
  } catch { return false; }
};

const UNIQUE_MARKETS = VOLATILITY_MARKETS
const TRADE_TYPES = ['Digits', 'Ups & Downs', 'Touch & No Touch', 'Multipliers', 'Accumulators', 'Vanillas', 'Turbos']
const SUB_TRADE_TYPES = { 'Digits': ['Over/Under', 'Matches/Differs', 'Even/Odd'], 'Ups & Downs': ['Rise/Fall', 'Higher/Lower'], 'Touch & No Touch': ['Touch/No Touch'], 'Multipliers': ['Multipliers'], 'Accumulators': [], 'Vanillas': ['Call/Put'], 'Turbos': ['Turbos'] }
const OPTIONS = { 'Over/Under': ['Over', 'Under', 'Both'], 'Matches/Differs': ['Matches', 'Differs', 'Both'], 'Even/Odd': ['Even', 'Odd', 'Both'], 'Rise/Fall': ['Rise', 'Fall', 'Both'], 'Higher/Lower': ['Higher', 'Lower', 'Both'], 'Touch/No Touch': ['Touch', 'No Touch', 'Both'], 'Multipliers': ['Up', 'Down', 'Both'], 'Call/Put': ['Call', 'Put', 'Both'], 'Turbos': ['Up', 'Down', 'Both'] }
const TIMEFRAME_RULES = { 'Digits': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 10 }, 'Ups & Downs': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1 }, 'Touch & No Touch': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1 }, 'Multipliers': { units: ['Auto'], defaultUnit: 'Auto', min: 1, fixed: true }, 'Accumulators': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 85 }, 'Vanillas': { units: ['Minutes', 'Hours', 'Days'], defaultUnit: 'Minutes', min: 1 }, 'Turbos': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1 } }

const roundStake = (v) => Math.round(v * 100) / 100

export default function AutomatedBot({ token, accountId, accountType = 'real', onBalanceUpdate }) {
  const [tradeType, setTradeType] = useState('Digits')
  const [subTradeType, setSubTradeType] = useState('Over/Under')
  const [option, setOption] = useState('Over')
  const [predictedDigit, setPredictedDigit] = useState('3')
  const [timeframeUnit, setTimeframeUnit] = useState('Ticks')
  const [durationValue, setDurationValue] = useState(1)
  const [stake, setStake] = useState('1.00')
  const [targetProfit, setTargetProfit] = useState('50.00')
  const [stopLoss, setStopLoss] = useState('20.00')
  const [martingaleFactor, setMartingaleFactor] = useState('1.5')
  
  const [isRunning, setIsRunning] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [logs, setLogs] = useState(() => { try { return JSON.parse(localStorage.getItem('mwathe:automated-bot-logs:v1') || 'null') || ['System initialized.'] } catch { return ['System initialized.'] } })
  const [currentPL, setCurrentPL] = useState(0.00)
  const [accountBalance, setAccountBalance] = useState(null)
  const [totalTrades, setTotalTrades] = useState(0)
  const [wins, setWins] = useState(0)
  const [losses, setLosses] = useState(0)
  const [currentStake, setCurrentStake] = useState(1.00)
  const [bestMarket, setBestMarket] = useState('Scanning...')
  const [confluenceScore, setConfluenceScore] = useState(0)
  const [researchMarketCount, setResearchMarketCount] = useState(0)
  const [researchDiagnostics, setResearchDiagnostics] = useState([])
  const [researchCycle, setResearchCycle] = useState(null)
  
  const logRef = useRef(null); const wsRef = useRef(null); const isRunningRef = useRef(false); const reqIdRef = useRef(1)
  const tickDataRef = useRef({}); const liveTickDataRef = useRef({}); const historySeededRef = useRef({}); const pendingLiveTicksRef = useRef({}); const lastLiveAtRef = useRef({}); const liveTickCountRef = useRef({}); const currentStakeRef = useRef(1.00); const sessionPLRef = useRef(0.00)
  const totalTradesRef = useRef(0); const winsRef = useRef(0); const lossesRef = useRef(0)
  const recoveryLedgerRef = useRef(createRecoveryLedger(1))
  const historyLoadedRef = useRef(false)
  const hasLoggedScanningRef = useRef(false); const reconnectAttemptsRef = useRef(0)
  const unsupportedNoticeRef = useRef('')
  const pingIntervalRef = useRef(null)
  const consecutiveLossesRef = useRef(0)
  const lastResearchNoticeRef = useRef('')
  const shouldAutoScrollRef = useRef(true)
  const accountBalanceRef = useRef(null)
  // Research runs on its own cadence and never waits for contract settlement.
  const latestResearchRef = useRef({ updatedAt: 0, candidates: [], marketCount: 0 })
  const researchInFlightRef = useRef(false)
  const researchTimerRef = useRef(null)
  const connectionActiveRef = useRef(false)
  const historyLoadInFlightRef = useRef(false)
  const researchConfigRef = useRef({})
  researchConfigRef.current = { tradeType, subTradeType, option, predictedDigit: Number(predictedDigit), duration: durationValue, timeframeUnit }

  const addLog = (msg) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-250))
  useEffect(() => { try { localStorage.setItem('mwathe:automated-bot-logs:v1', JSON.stringify(logs)) } catch {} }, [logs])
  useEffect(() => { if (logRef.current && shouldAutoScrollRef.current) requestAnimationFrame(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }) }, [logs])
  useEffect(() => { if (SUB_TRADE_TYPES[tradeType]?.length > 0) setSubTradeType(SUB_TRADE_TYPES[tradeType][0]); else setSubTradeType('') }, [tradeType])
  useEffect(() => { if (subTradeType && OPTIONS[subTradeType]) setOption(OPTIONS[subTradeType][0]) }, [subTradeType])
  useEffect(() => { const rules = TIMEFRAME_RULES[tradeType]; setTimeframeUnit(rules.defaultUnit); setDurationValue(rules.min) }, [tradeType])
  useEffect(() => { if (!isRunning) { const s = parseFloat(stake) || 1.00; setCurrentStake(s); currentStakeRef.current = s } }, [stake, isRunning])

  useEffect(() => {
    if (!token || !accountId) return
    connectionActiveRef.current = true
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          reconnectAttemptsRef.current = 0
          connectWS()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    
    const connectWS = async () => {
      if (!connectionActiveRef.current) return
      try {
        const response = await fetch(`https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } })
        const data = await response.json()
        if (!data.data?.url) throw new Error('No WebSocket URL')
        if (wsRef.current) wsRef.current.close()
        const ws = new WebSocket(data.data.url)
        wsRef.current = ws
        ws.onopen = () => { ws.send(JSON.stringify({ balance: 1, subscribe: 1, req_id: reqIdRef.current++ })); 
          reconnectAttemptsRef.current = 0
          if(isRunningRef.current) addLog('Connection restored.')
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ ping: 1, req_id: reqIdRef.current++ }))
          }, 20000)
        }
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (msg.msg_type === 'history' && msg.history?.prices) {
              const symbol = msg.history.symbol || msg.echo_req?.ticks_history
              if (symbol) {
                tickDataRef.current[symbol] = seedTickBuffer(msg.history.prices, pendingLiveTicksRef.current[symbol] || [])
                liveTickDataRef.current[symbol] = []
                historySeededRef.current[symbol] = true
                lastLiveAtRef.current[symbol] = 0
                liveTickCountRef.current[symbol] = 0
                delete pendingLiveTicksRef.current[symbol]
              }
            }
            if (msg.msg_type === 'tick' && msg.tick?.symbol) {
              const symbol = msg.tick.symbol
              if (historySeededRef.current[symbol]) {
                tickDataRef.current[symbol] = appendTickBuffer(tickDataRef.current[symbol], msg.tick.quote)
                liveTickDataRef.current[symbol] = appendTickBuffer(liveTickDataRef.current[symbol], msg.tick.quote)
                lastLiveAtRef.current[symbol] = Date.now()
                liveTickCountRef.current[symbol] = (liveTickCountRef.current[symbol] || 0) + 1
              }
              advancePaperTrials(symbol, { quote: msg.tick.quote, pipSize: msg.tick.pip_size })
              // Forward-trial outcomes update calibration silently; the user sees only real trades.
              if (!historySeededRef.current[symbol]) {
                pendingLiveTicksRef.current[symbol] = appendTickBuffer(pendingLiveTicksRef.current[symbol], msg.tick.quote)
              }
            }
            if (msg.msg_type === 'balance' && msg.balance?.balance !== undefined) { accountBalanceRef.current = parseFloat(msg.balance.balance); setAccountBalance(accountBalanceRef.current); if (onBalanceUpdate) onBalanceUpdate(accountBalanceRef.current) }
          } catch (e) {}
        }
        ws.onclose = () => {
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
          historyLoadedRef.current = false
          historyLoadInFlightRef.current = false
          liveTickDataRef.current = {}
          liveTickCountRef.current = {}
          lastLiveAtRef.current = {}
          // A closed Deriv socket loses every tick subscription. Force all
          // market history/tick subscriptions to be recreated after reconnect.
          historySeededRef.current = {}
          pendingLiveTicksRef.current = {}
          tickDataRef.current = {}
          if (researchTimerRef.current) { clearInterval(researchTimerRef.current); researchTimerRef.current = null }
          if (wsRef.current === ws) wsRef.current = null
          if (connectionActiveRef.current) {
            reconnectAttemptsRef.current++
            const delay = Math.min(3000 * reconnectAttemptsRef.current, 30000)
            if (reconnectAttemptsRef.current === 20) {
              addLog('Connection unavailable; retrying.')
            }
            setTimeout(connectWS, delay)
          }
        }
      } catch (err) {
        addLog('Connection failed; retrying.')
        if (connectionActiveRef.current) {
          reconnectAttemptsRef.current++
          const delay = Math.min(3000 * reconnectAttemptsRef.current, 30000)
          setTimeout(connectWS, delay)
        }
      }
    }
    connectWS()
    return () => { 
      connectionActiveRef.current = false
      if (wsRef.current) wsRef.current.close()
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [token, accountId])

  const loadAllHistory = () => {
    if (historyLoadedRef.current || historyLoadInFlightRef.current) return Promise.resolve()
    historyLoadInFlightRef.current = true
    return new Promise((resolve) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) { historyLoadInFlightRef.current = false; return resolve() }
      let loadedCount = 0
      let finished = false
      const listeners = []
      let completedCount = 0
      const pendingMarkets = UNIQUE_MARKETS.filter(([, sym]) => !historySeededRef.current[sym])
      const totalMarkets = pendingMarkets.length
      const finish = (complete = false) => {
        if (finished) return
        finished = true
        listeners.forEach(({ handler }) => wsRef.current?.removeEventListener('message', handler))
        historyLoadedRef.current = complete
        historyLoadInFlightRef.current = false
        if (!complete) addLog(`Market data incomplete (${completedCount}/${totalMarkets}); waiting for feeds.`)
        resolve()
      }
      if (totalMarkets === 0) return finish(true)
      const checkDone = success => {
        if (success) completedCount++
        loadedCount++
        if (loadedCount >= totalMarkets) finish(completedCount === totalMarkets)
      }
      pendingMarkets.forEach(([,sym]) => {
        const reqId = reqIdRef.current++
        const onMessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (msg.req_id === reqId && (msg.msg_type === 'history' || msg.error)) {
              wsRef.current?.removeEventListener('message', onMessage)
              checkDone(msg.msg_type === 'history' && Array.isArray(msg.history?.prices) && msg.history.prices.length > 0)
            }
          } catch (e) {}
        }
        listeners.push({ handler: onMessage })
        wsRef.current.addEventListener('message', onMessage)
        wsRef.current.send(JSON.stringify({ ticks_history: sym, count: 250, end: 'latest', style: 'ticks', subscribe: 1, req_id: reqId }))
      })
      setTimeout(() => finish(false), 10000)
    })
  }

  const wsRequest = (request) => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return reject(new Error('WebSocket not connected'))
      const req_id = reqIdRef.current++
      const onMessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.req_id === req_id) {
            wsRef.current.removeEventListener('message', onMessage)
            if (msg.error) reject(new Error(msg.error.message || 'API Error'))
            else resolve(msg)
          }
        } catch (e) {}
      }
      wsRef.current.addEventListener('message', onMessage)
      wsRef.current.send(JSON.stringify({ ...request, req_id }))
      setTimeout(() => { wsRef.current.removeEventListener('message', onMessage); reject(new Error('Timeout')) }, 15000)
    })
  }

  const monitorContract = (contract_id) => {
    return new Promise((resolve) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return resolve(null)
      let sub_id = null
      const onMessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.msg_type === 'proposal_open_contract' && msg.proposal_open_contract?.contract_id === contract_id) {
            if (msg.subscription?.id) sub_id = msg.subscription.id
            if (msg.proposal_open_contract.is_sold) {
              wsRef.current.removeEventListener('message', onMessage)
              if (sub_id) wsRef.current.send(JSON.stringify({ forget: sub_id, req_id: reqIdRef.current++ }))
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ balance: 1, subscribe: 1, req_id: reqIdRef.current++ }));
              }
              resolve(msg.proposal_open_contract)
            } else {
              setCurrentPL(sessionPLRef.current + parseFloat(msg.proposal_open_contract.profit || 0))
            }
          }
        } catch (e) {}
      }
      wsRef.current.addEventListener('message', onMessage)
      wsRef.current.send(JSON.stringify({ proposal_open_contract: 1, contract_id, subscribe: 1, req_id: reqIdRef.current++ }))
    })
  }

  // Shared market + contract ranking. A market is considered only after fresh live ticks.
  const scanMarkets = async () => {
    const markets = UNIQUE_MARKETS.map(([name, symbol]) => ({
      name, symbol, prices: tickDataRef.current[symbol] || [], livePrices: liveTickDataRef.current[symbol] || [],
      lastLiveAt: lastLiveAtRef.current[symbol] || 0,
      liveTicks: liveTickCountRef.current[symbol] || 0
    }))
    const selectedConfig = researchConfigRef.current
    const universe = await rankLiveStrategyUniverse(markets, selectedConfig, {
      now: Date.now(), maxAgeMs: 5000, minLiveTicks: 1,
      onMarketDiagnostics: setResearchDiagnostics,
      onResearchCycle: setResearchCycle
    })
    // Research all supported profiles, but only the exact user-selected profile
    // is eligible to enter the bot's existing validation/execution path.
    const now = Date.now()
    const freshMarketCount = markets.filter(m => m.lastLiveAt && now - m.lastLiveAt >= 0 && now - m.lastLiveAt <= 5000 && Number(m.liveTicks) >= 1 && (m.livePrices || []).length >= 1).length
    setResearchMarketCount(freshMarketCount)
    if (universe[0]) { setBestMarket(universe[0].marketName); setConfluenceScore(universe[0].score) }
    const eligible = universe.filter(item => {
      return item.profile.tradeType === selectedConfig.tradeType
      && item.profile.subTradeType === (selectedConfig.subTradeType || '')
      && item.profile.timeframeUnit === selectedConfig.timeframeUnit
      && Number(item.profile.duration) === Number(selectedConfig.duration)
      && item.qualified === true

    })
    latestResearchRef.current = { updatedAt: now, candidates: eligible, marketCount: freshMarketCount }
    return eligible
  }

  const refreshResearch = async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || researchInFlightRef.current) return
    researchInFlightRef.current = true
    try { await scanMarkets() }
    catch (error) { addLog('Market research temporarily unavailable.') }
    finally { researchInFlightRef.current = false }
  }

  // The 13 live subscriptions and ranking loop are independent of trade execution.
  useEffect(() => {
    let active = true
    const ensureResearch = async () => {
      if (!active || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
      // Start the history preload in the background. Each market becomes
      // researchable as soon as its own history and first live tick arrive;
      // one slow market must not block the other twelve.
      if (!historyLoadedRef.current && !historyLoadInFlightRef.current) void loadAllHistory()
      if (!active || researchTimerRef.current) return
      await refreshResearch()
      if (active && !researchTimerRef.current) researchTimerRef.current = setInterval(refreshResearch, 1000)
    }
    ensureResearch()
    const connectionPoll = setInterval(ensureResearch, 1000)
    return () => {
      active = false
      clearInterval(connectionPoll)
      if (researchTimerRef.current) clearInterval(researchTimerRef.current)
      researchTimerRef.current = null
    }
  }, [token, accountId])

  const runTradeCycle = async () => {
    if (!historyLoadedRef.current && !historyLoadInFlightRef.current) void loadAllHistory()

    while (isRunningRef.current) {
      try {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) { await new Promise(r => setTimeout(r, 3000)); continue }
        
        // Consume the latest independently refreshed research snapshot. A stale
        // snapshot is never used for entry; the next parallel pass refreshes it.
        const researchSnapshot = latestResearchRef.current
        const refreshedQueue = Date.now() - researchSnapshot.updatedAt <= 2500 ? researchSnapshot.candidates : []
        const currentTarget = refreshedQueue[0]
        if (!currentTarget) {
          if (!hasLoggedScanningRef.current) {
          addLog('Monitoring markets; waiting for a qualified setup.')
          hasLoggedScanningRef.current = true
        }
        await new Promise(r => setTimeout(r, 1000))
          continue
        }
        hasLoggedScanningRef.current = false
        const signal = {
          ...currentTarget.signal,
          growthRate: 0.01, multiplier: 100, takeProfit: 1, contractStopLoss: 1
        }
        // Apply the existing cross-market strategy cooldown before asking for a quote.
        const adaptiveGate = getAdaptiveStrategyStatus(signal)
        if (adaptiveGate.blocked) {
          const cooldownKey = `${adaptiveGate.key}:${adaptiveGate.blockedUntil}`
          if (lastResearchNoticeRef.current !== cooldownKey) {
            addLog('Risk control active; entries temporarily paused.')
            lastResearchNoticeRef.current = cooldownKey
          }
          await new Promise(resolve => setTimeout(resolve, Math.min(5000, Math.max(500, adaptiveGate.blockedUntil - Date.now()))))
          continue
        }
        const accountRisk = evaluateAccountRisk({ balance: accountBalanceRef.current, sessionPL: sessionPLRef.current, targetProfit, stopLoss, nextStake: currentStakeRef.current })
        if (!accountRisk.allowEntry) {
          if (accountRisk.balanceUnavailable) { addLog('Waiting for account balance confirmation.'); await new Promise(resolve => setTimeout(resolve, 1000)); continue }
          addLog('Risk limit reached; new entries stopped.'); isRunningRef.current = false; setIsRunning(false); break
        }
        // No contract family may bypass its own forward-outcome model.
        // Until a family-specific model is implemented and calibrated, fail closed.
        if (!supportsForwardCalibration(signal)) {
          const unsupportedKey = `${signal.tradeType}|${signal.subTradeType || ''}|${signal.timeframeUnit}`;
          if (unsupportedNoticeRef.current !== unsupportedKey) {
            addLog(`No validated outcome model for ${signal.tradeType} / ${signal.subTradeType || 'default'} yet; trading this type is paused.`);
            unsupportedNoticeRef.current = unsupportedKey;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        lastResearchNoticeRef.current = ''
        setBestMarket(currentTarget.marketName); setConfluenceScore(currentTarget.score)
        
        // Reprice a bounded number of times because payout can vary with stake.
        // Do not mutate the live stake until one quote agrees with its recovery size.
        let requestedStake = roundStake(currentStakeRef.current)
        let proposalRes = null
        let quoteRecovery = null
        let quoteConverged = false
        for (let quoteAttempt = 0; quoteAttempt < 3; quoteAttempt++) {
          proposalRes = await wsRequest(buildProposal(signal, requestedStake))
          if (!isRunningRef.current) break
          const quoteAsk = Number(proposalRes.proposal?.ask_price)
          const quotePayout = Number(proposalRes.proposal?.payout)
          const quoteNetRate = quoteAsk > 0 && quotePayout > quoteAsk ? (quotePayout - quoteAsk) / quoteAsk : 0
          quoteRecovery = nextRecoveryStake(recoveryLedgerRef.current, {
            baseStake: parseFloat(stake) || 1, martingaleFactor: parseFloat(martingaleFactor) || 1,
            netProfitPerUnit: quoteNetRate, maxStakeMultiplier: 3
          })
          if (!quoteRecovery.allowed) {
            addLog('Recovery limit reached; no further entry will be placed.')
            isRunningRef.current = false; setIsRunning(false); break
          }
          if (Math.abs(quoteRecovery.stake - requestedStake) < 0.01) {
            quoteConverged = true
            break
          }
          const riskAtRecoveryStake = evaluateAccountRisk({ balance: accountBalanceRef.current, sessionPL: sessionPLRef.current, targetProfit, stopLoss, nextStake: quoteRecovery.stake })
          if (!riskAtRecoveryStake.allowEntry) {
            addLog('Recovery stake exceeds the account risk limit; trading stopped.')
            isRunningRef.current = false; setIsRunning(false); break
          }
          requestedStake = roundStake(quoteRecovery.stake)
        }
        if (!isRunningRef.current) break
        if (!quoteConverged || !proposalRes?.proposal || !quoteRecovery) {
          
          await new Promise(resolve => setTimeout(resolve, 500))
          continue
        }
        currentStakeRef.current = requestedStake
        setCurrentStake(requestedStake)
        if (signal.tradeType === 'Digits' && signal.timeframeUnit === 'Ticks') {
          let calibration = getPaperForwardSummary(signal)
          if (!calibration.calibrated) {
            // Build non-overlapping forward evidence on both demo and real accounts.
            // No purchase is sent while the exact profile is still being validated.
            const started = beginPaperTrial({ ...signal, id: `paper-${signal.symbol}-${Date.now()}` }, {
              quote: { askPrice: proposalRes.proposal.ask_price, payout: proposalRes.proposal.payout,
                currency: proposalRes.proposal.currency, quotedAt: Date.now() }
            })
            if (started) {
              
            } else if (calibration.pending === 0) {
              
              continue
            }
            const waitUntil = Date.now() + Math.max(15000, Number(signal.duration) * 5000)
            while (isRunningRef.current && getPaperForwardSummary(signal).pending > 0 && Date.now() < waitUntil) {
              await new Promise(resolve => setTimeout(resolve, 250))
            }
            calibration = getPaperForwardSummary(signal)
            if (calibration.pending > 0) {
              
              continue
            }
            if (!calibration.calibrated) {
              
              continue
            }
          }
          const forwardGate = evaluateForwardCalibrationGate(calibration, proposalRes.proposal)
          if (!forwardGate.allowed) {
            
            continue
          }
          
        }
        const marketSnapshot = {
          prices: liveTickDataRef.current[currentTarget.symbol] || [],
          lastLiveAt: lastLiveAtRef.current[currentTarget.symbol] || 0
        }
        const liveCheck = validateLiveOpportunity(signal, marketSnapshot, { now: Date.now(), maxSignalAgeMs: 1500 })
        if (!liveCheck.valid) {
          
          continue
        }
        const entryCheck = validateEntryWindow(signal, { maxSignalAgeMs: 1500, proposalBudgetMs: 300, minimumRemainingMs: 250 })
        if (!entryCheck.valid) { ; continue }
        
        const buyRes = await wsRequest({ buy: proposalRes.proposal.id, price: proposalRes.proposal.ask_price })
        addLog(`Trade opened: ${signal.market} — ${signal.option} — ${requestedStake.toFixed(2)}.`)
        
        const contractResult = await monitorContract(buyRes.buy.contract_id); if (!contractResult) break
        const profit = parseFloat(contractResult.profit || 0); const isWin = profit > 0
        if (signal.tradeType === 'Digits' && signal.timeframeUnit === 'Ticks') {
          const settledCalibration = recordSettledContractOutcome(signal, {
            quote: proposalRes.proposal, profit, contractId: contractResult.contract_id
          })
          if (settledCalibration) 
        }
        recordContractOutcome(signal, { profit, stake: currentStakeRef.current, contractId: contractResult.contract_id, bot: 'Automated Bot' })
        recordAdaptiveOutcome(signal, { profit, stake: currentStakeRef.current, bot: 'Automated Bot' })
        
        
        totalTradesRef.current += 1
        sessionPLRef.current += profit
        if (isWin) {
          winsRef.current += 1
          consecutiveLossesRef.current = 0
          lastResearchNoticeRef.current = ''
        } else {
          lossesRef.current += 1
          consecutiveLossesRef.current++
        }
        // A broker-confirmed settlement must be visible before evaluating the next stake.
        setTotalTrades(totalTradesRef.current)
        setWins(winsRef.current)
        setLosses(lossesRef.current)
        setCurrentPL(sessionPLRef.current)
        addLog(`${isWin ? 'WIN' : 'LOSS'} ${profit >= 0 ? '+' : '-'}${Math.abs(profit).toFixed(2)} | Session P/L ${sessionPLRef.current.toFixed(2)}.`)
        const quotedAsk = Number(proposalRes.proposal.ask_price)
        const quotedPayout = Number(proposalRes.proposal.payout)
        const netProfitPerUnit = quotedAsk > 0 && quotedPayout > quotedAsk ? (quotedPayout - quotedAsk) / quotedAsk : 0
        recoveryLedgerRef.current = recordRecoveryOutcome(recoveryLedgerRef.current, {
          profit, baseStakeWinProfit: (parseFloat(stake) || 1) * netProfitPerUnit
        })
        const recoveryDecision = nextRecoveryStake(recoveryLedgerRef.current, {
          baseStake: parseFloat(stake) || 1, martingaleFactor: parseFloat(martingaleFactor) || 1,
          netProfitPerUnit, maxStakeMultiplier: 3
        })
        if (!recoveryDecision.allowed) {
          addLog('Recovery limit reached; new entries stopped.')
          isRunningRef.current = false; setIsRunning(false); break
        }
        
        currentStakeRef.current = recoveryDecision.stake
        setCurrentStake(currentStakeRef.current)
        if (sessionPLRef.current >= parseFloat(targetProfit)) { addLog(`Profit target reached (${sessionPLRef.current.toFixed(2)}); new trades stopped.`); setIsRunning(false); isRunningRef.current = false; break }
        if (sessionPLRef.current <= -parseFloat(stopLoss)) { addLog(`Configured loss limit reached (${sessionPLRef.current.toFixed(2)}); new trades stopped.`); setIsRunning(false); isRunningRef.current = false; break }
        await new Promise(r => setTimeout(r, 250))
      } catch (error) { if (!isRunningRef.current) break; addLog('Trading cycle error; retrying after a pause.'); await new Promise(r => setTimeout(r, 2000)) }
    }
    researchInFlightRef.current = false
  }

  const startBot = () => {
    setValidationError(''); if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) { setValidationError('Not connected.'); return }
    isRunningRef.current = true; setIsRunning(true); sessionPLRef.current = 0; totalTradesRef.current = 0; winsRef.current = 0; lossesRef.current = 0
    currentStakeRef.current = parseFloat(stake); recoveryLedgerRef.current = createRecoveryLedger(parseFloat(stake) || 1); hasLoggedScanningRef.current = false; reconnectAttemptsRef.current = 0
    consecutiveLossesRef.current = 0
    unsupportedNoticeRef.current = ''
    setCurrentPL(0); setTotalTrades(0); setWins(0); setLosses(0); setCurrentStake(parseFloat(stake)); setConfluenceScore(0)
    addLog(`Bot started — monitoring 13 markets. Selected strategy: ${tradeType}${subTradeType ? ` / ${subTradeType}` : ''}.`); runTradeCycle()
  }

  const stopBot = () => { isRunningRef.current = false; setIsRunning(false); addLog('New entries stopped; live research continues.') }
  const resetBot = () => { if (isRunningRef.current) return; setLogs([]); try { localStorage.removeItem('mwathe:automated-bot-logs:v1') } catch {}; shouldAutoScrollRef.current = true; setValidationError('') }
  const rules = TIMEFRAME_RULES[tradeType]; const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0'

  return (
    <div className="h-full flex flex-col bg-gray-950 text-white p-2 overflow-hidden">
      <div className="flex items-center gap-2 pb-1 border-b border-gray-800 mb-2 flex-shrink-0">
        <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-green-500 rounded-lg flex items-center justify-center"><Zap size={16} className="text-white" /></div>
        <div><h2 className="text-base font-bold text-white">Automated Bot</h2><p className="text-[10px] text-gray-400 flex items-center gap-1"><ShieldCheck size={10} /> 13 Markets | Hard Gates</p></div>
      </div>
      {validationError && <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-2 mb-2 flex items-center gap-2 flex-shrink-0"><AlertCircle size={12} className="text-red-500" /><p className="text-red-400 text-[10px] font-medium">{validationError}</p></div>}
      <div className="bg-gray-900 rounded-lg p-2 border border-gray-800 mb-2 flex-shrink-0 overflow-y-auto" style={{maxHeight: '28vh'}}>
        <h3 className="text-white font-bold text-xs flex items-center gap-1 mb-2"><Target size={12} className="text-orange-500" /> Parameters</h3>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div><label className="text-[10px] text-gray-400 uppercase font-bold">Type</label><select value={tradeType} onChange={e => setTradeType(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{TRADE_TYPES.map(t => <option key={t} className="text-white">{t}</option>)}</select></div>
          {SUB_TRADE_TYPES[tradeType]?.length > 0 && <div><label className="text-[10px] text-gray-400 uppercase font-bold">Sub Type</label><select value={subTradeType} onChange={e => setSubTradeType(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{SUB_TRADE_TYPES[tradeType].map(t => <option key={t} className="text-white">{t}</option>)}</select></div>}
        </div>
        {subTradeType && OPTIONS[subTradeType] && <div className="mb-2"><label className="text-[10px] text-gray-400 uppercase font-bold mb-1 block">Option</label><div className="grid grid-cols-3 gap-1">{OPTIONS[subTradeType].map(opt => <button key={opt} onClick={() => setOption(opt)} disabled={isRunning} className={`py-1.5 rounded text-xs font-bold border ${option === opt ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-black border-gray-700 text-gray-400'}`}>{opt}</button>)}</div></div>}
        {(tradeType === 'Digits' && subTradeType === 'Over/Under') && <div className="mb-2"><label className="text-[10px] text-gray-400 uppercase font-bold">Barrier/Digit</label><input type="number" min="0" max="9" value={predictedDigit} onChange={e => setPredictedDigit(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div>}
        {tradeType === 'Touch & No Touch' && <div className="mb-2"><label className="text-[10px] text-gray-400 uppercase font-bold">Barrier</label><input type="number" value={predictedDigit} onChange={e => setPredictedDigit(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div>}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div><label className="text-[10px] text-gray-400 uppercase font-bold">Time</label>{rules.fixed ? <input type="text" value={rules.defaultUnit} disabled className="w-full bg-black/50 border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-gray-500" /> : <select value={timeframeUnit} onChange={e => { setTimeframeUnit(e.target.value); setDurationValue(rules.min) }} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{rules.units.map(u => <option key={u} className="text-white">{u}</option>)}</select>}</div>
          <div><label className="text-[10px] text-gray-400 uppercase font-bold">Duration</label><input type="number" value={durationValue} onChange={e => setDurationValue(parseInt(e.target.value) || 0)} disabled={isRunning || rules.fixed} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div><label className="text-[10px] text-gray-400 uppercase font-bold">Stake</label><input type="number" step="0.01" value={stake} onChange={e => setStake(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div>
          <div><label className="text-[10px] text-gray-400 uppercase font-bold">Martingale</label><input type="number" min="1" max="3" step="0.1" value={martingaleFactor} onChange={e => setMartingaleFactor(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[10px] text-gray-400 uppercase font-bold">Target</label><input type="number" step="0.01" value={targetProfit} onChange={e => setTargetProfit(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div>
          <div><label className="text-[10px] text-gray-400 uppercase font-bold">Stop Loss</label><input type="number" step="0.01" value={stopLoss} onChange={e => setStopLoss(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div>
        </div>
      </div>
      <div className="bg-gray-900 rounded-lg p-2 border border-green-500/30 mb-2 flex-shrink-0">
  <h3 className="text-white font-bold text-xs mb-1 flex items-center gap-1"><TrendingUp size={12} className="text-green-500" /> Performance</h3>
  <div className="mb-1 flex justify-between items-center bg-black/50 rounded p-1"><span className="text-[9px] text-gray-400">Fresh live markets:</span><span className="text-[10px] text-green-400 font-bold">{researchMarketCount}/13 markets</span></div>
  <div className="mb-1 flex justify-between items-center bg-black/50 rounded p-1"><span className="text-[9px] text-gray-400">Research cycle:</span><span className="text-[10px] text-sky-300 font-bold">{researchCycle ? `${researchCycle.analysedMarkets}/${researchCycle.expectedMarkets} markets · ${researchCycle.cycleDurationMs}ms` : 'Waiting for first cycle'}</span></div>
  <div className="mb-1 flex justify-between items-center bg-black/50 rounded p-1"><span className="text-[9px] text-gray-400">Profile evaluations:</span><span className="text-[10px] text-sky-300 font-bold">{researchCycle ? `${researchCycle.totalMarketProfileEvaluations.toLocaleString()} · ${researchCycle.parallelMarketCount} markets × ${researchCycle.profileCount} profiles` : '—'}</span></div>
  <div className="mb-1 flex justify-between items-center bg-black/50 rounded p-1"><span className="text-[9px] text-gray-400">Best Market:</span><span className="text-[10px] text-orange-400 font-bold">{bestMarket}</span></div>
  <div className="mb-1 flex justify-between items-center bg-black/50 rounded p-1"><span className="text-[9px] text-gray-400">Confluence Score:</span><span className={`text-[10px] font-bold ${confluenceScore >= 70 ? 'text-green-400' : 'text-orange-400'}`}>{confluenceScore.toFixed(0)}%</span></div>
  <details className="mb-2 bg-black/40 border border-gray-800 rounded p-2 flex-shrink-0">
    <summary className="text-[10px] text-sky-300 font-bold cursor-pointer">13-market live research evidence ({researchDiagnostics.filter(row => row.analysisComplete).length}/13 fully evaluated)</summary>
    <div className="mt-2 overflow-x-auto"><table className="w-full text-[9px] text-left"><thead><tr className="text-gray-500 border-b border-gray-800"><th className="py-1 pr-2">Market</th><th className="py-1 pr-2">Status</th><th className="py-1 pr-2">Ticks</th><th className="py-1 pr-2">Profiles</th><th className="py-1 pr-2">Rank</th><th className="py-1 pr-2">Score</th><th className="py-1">Last analysed</th></tr></thead><tbody>
      {researchDiagnostics.map(row => <tr key={row.symbol} className="border-b border-gray-900"><td className="py-1 pr-2 text-gray-300">{row.marketName}</td><td className={`py-1 pr-2 ${row.status === 'STALE_FEED' || row.status === 'INSUFFICIENT_LIVE_TICKS' ? 'text-orange-400' : row.analysisComplete ? 'text-green-400' : 'text-sky-300'}`}>{row.status}</td><td className="py-1 pr-2 tabular-nums">{row.liveTicks}/{row.liveBufferSize}</td><td className="py-1 pr-2 tabular-nums">{row.profileEvaluations}/{row.profileCount}</td><td className="py-1 pr-2 tabular-nums">{row.rank ?? '—'}</td><td className="py-1 pr-2 tabular-nums">{row.score == null ? '—' : row.score.toFixed(0)}</td><td className="py-1 tabular-nums">{row.evaluationCompletedAt ? new Date(row.evaluationCompletedAt).toLocaleTimeString() : '—'}</td></tr>)}
    </tbody></table></div>
    {researchCycle && <p className="mt-1 text-[9px] text-gray-500">Cycle {new Date(researchCycle.cycleStartedAt).toLocaleTimeString()}–{new Date(researchCycle.cycleCompletedAt).toLocaleTimeString()} · {researchCycle.rankingCount} ranked opportunities · {researchCycle.best ? `Leader: ${researchCycle.best.marketName} (${researchCycle.best.score.toFixed(0)})` : 'No current candidate'}.</p>}
  </details>
  <div className="mb-1 grid grid-cols-3 gap-1 text-center text-[9px]">
    <div className="bg-black/50 rounded p-1"><span className="text-gray-400">Account balance</span><p className="text-white font-bold">{accountBalance === null ? 'Waiting…' : '$' + accountBalance.toFixed(2)}</p></div>
    <div className="bg-black/50 rounded p-1"><span className="text-gray-400">To target</span><p className="text-green-400 font-bold">{'$' + Math.max(0, (parseFloat(targetProfit) || 0) - currentPL).toFixed(2)}</p></div>
    <div className="bg-black/50 rounded p-1"><span className="text-gray-400">Loss allowance</span><p className="text-orange-400 font-bold">{'$' + Math.max(0, (parseFloat(stopLoss) || 0) + currentPL).toFixed(2)}</p></div>
  </div>
  <div className="grid grid-cols-4 gap-1 text-center mb-1">
    <div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">P/L</p><p className={`font-bold text-xs ${currentPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>{currentPL >= 0 ? '+' : ''}{currentPL.toFixed(2)}</p></div>
    <div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">Win Rate</p><p className="text-sky-400 font-bold text-xs">{winRate}%</p></div>
    <div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">Trades</p><p className="text-white font-bold text-xs">{totalTrades}</p></div>
    <div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">Next</p><p className="text-orange-400 font-bold text-xs">{currentStake.toFixed(2)}</p></div>
  </div>
  <div className="grid grid-cols-2 gap-2">
    <div className="bg-green-900/20 border border-green-500/30 rounded p-1 text-center"><p className="text-[9px] text-green-400 uppercase font-bold">Trades Won</p><p className="text-green-400 font-bold text-lg">{wins}</p></div>
    <div className="bg-red-900/20 border border-red-500/30 rounded p-1 text-center"><p className="text-[9px] text-red-400 uppercase font-bold">Trades Lost</p><p className="text-red-400 font-bold text-lg">{losses}</p></div>
  </div>
</div>
      <div className="grid grid-cols-3 gap-2 flex-shrink-0 mb-2">
        <button onClick={startBot} disabled={isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${isRunning ? 'bg-gray-800 text-gray-500' : 'bg-green-500 text-black'}`}><Play size={14} /> Run</button>
        <button onClick={stopBot} disabled={!isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${!isRunning ? 'bg-gray-800 text-gray-500' : 'bg-red-500 text-white'}`}><Square size={14} /> Stop</button>
        <button onClick={resetBot} disabled={isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${isRunning?'bg-gray-900 text-gray-600':'bg-gray-800 border border-gray-700 text-orange-400'}`}><RefreshCw size={14} /> Reset</button>
      </div>
      <div className="bg-black rounded-lg border border-gray-800 overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="bg-gray-900 px-2 py-1 flex items-center justify-between gap-2 border-b border-gray-800 flex-shrink-0"><div className="flex items-center gap-1"><Terminal size={10} className="text-green-500" /><span className="text-[10px] text-gray-400 font-bold">EXECUTION LOG</span></div><button type="button" onClick={async()=>{const copied=await copyLogFeed(logs);addLog(copied?"📋 Complete log feed copied to clipboard.":"⚠️ Clipboard unavailable; try long-pressing a log entry.")}} className="text-[10px] font-semibold text-sky-300 px-2 py-1 rounded border border-gray-700 active:bg-gray-700">Copy all</button></div>
        <div ref={logRef} onScroll={() => { const el = logRef.current; if (el) shouldAutoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60 }} className="log-selectable flex-1 p-2 overflow-y-auto font-mono text-[10px] space-y-0.5" style={{scrollBehavior: 'auto'}}>
          {logs.map((log, i) => <p key={i} className={log.includes('✅') || log.includes('WON') || log.includes('TARGET') ? 'text-green-400' : log.includes('❌') || log.includes('LOST') || log.includes('Error') || log.includes('STOP') ? 'text-red-500' : log.includes('🚀') || log.includes('') || log.includes('🔬') || log.includes('⏳') || log.includes('') || log.includes('⚠️') ? 'text-sky-400' : log.includes('━━') ? 'text-gray-600' : 'text-gray-400'}>{log}</p>)}
        </div>
      </div>
    </div>
  )
}
 