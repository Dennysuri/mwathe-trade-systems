import { useState, useRef, useEffect } from 'react'
import { Play, Square, RefreshCw, Terminal, AlertCircle, TrendingUp, Target, ShieldCheck, Zap } from 'lucide-react'
import { boundedNextStake, buildProposal, VOLATILITY_MARKETS } from '../services/tradingCore'
import { validateEntryWindow } from '../services/strategyIntelligence'
import { validateLiveOpportunity } from '../services/liveOpportunityEngine'
import { rankLiveStrategyUniverse } from '../services/strategyUniverse'
import { recordContractOutcome } from '../services/contractOutcomeIntelligence'
import { evaluateAccountRisk, getAdaptiveStrategyStatus, getContractDifficulty, recordAdaptiveOutcome } from '../services/adaptiveTradingIntelligence'
import { advancePaperTrials, beginPaperTrial, getPaperForwardSummary } from '../services/paperForwardCalibration'
import { appendTickBuffer, seedTickBuffer } from '../services/marketTickBuffer'

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

export default function AutomatedBot({ token, accountId, onBalanceUpdate }) {
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
  
  const logRef = useRef(null); const wsRef = useRef(null); const isRunningRef = useRef(false); const reqIdRef = useRef(1)
  const tickDataRef = useRef({}); const historySeededRef = useRef({}); const pendingLiveTicksRef = useRef({}); const lastLiveAtRef = useRef({}); const liveTickCountRef = useRef({}); const currentStakeRef = useRef(1.00); const sessionPLRef = useRef(0.00)
  const totalTradesRef = useRef(0); const winsRef = useRef(0); const lossesRef = useRef(0)
  const historyLoadedRef = useRef(false)
  const hasLoggedScanningRef = useRef(false); const reconnectAttemptsRef = useRef(0)
  const pingIntervalRef = useRef(null)
  const consecutiveLossesRef = useRef(0)
  const lastResearchNoticeRef = useRef('')
  const marketCooldownUntilRef = useRef({})
  const recentOutcomesRef = useRef([])
  const performanceCooldownUntilRef = useRef(0)
  const performanceRecoveryUntilRef = useRef(0)
  const lastPerformancePauseNoticeRef = useRef(0)
  const shouldAutoScrollRef = useRef(true)
  const accountBalanceRef = useRef(null)
  // Research runs on its own cadence and never waits for contract settlement.
  const latestResearchRef = useRef({ updatedAt: 0, candidates: [], marketCount: 0 })
  const researchInFlightRef = useRef(false)
  const researchTimerRef = useRef(null)
  const historyLoadInFlightRef = useRef(false)
  const researchConfigRef = useRef({})
  researchConfigRef.current = { tradeType, subTradeType, option, predictedDigit: Number(predictedDigit), duration: durationValue, timeframeUnit }

  const addLog = (msg) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-2000))
  useEffect(() => { try { localStorage.setItem('mwathe:automated-bot-logs:v1', JSON.stringify(logs)) } catch {} }, [logs])
  useEffect(() => { if (logRef.current && shouldAutoScrollRef.current) requestAnimationFrame(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }) }, [logs])
  useEffect(() => { if (SUB_TRADE_TYPES[tradeType]?.length > 0) setSubTradeType(SUB_TRADE_TYPES[tradeType][0]); else setSubTradeType('') }, [tradeType])
  useEffect(() => { if (subTradeType && OPTIONS[subTradeType]) setOption(OPTIONS[subTradeType][0]) }, [subTradeType])
  useEffect(() => { const rules = TIMEFRAME_RULES[tradeType]; setTimeframeUnit(rules.defaultUnit); setDurationValue(rules.min) }, [tradeType])
  useEffect(() => { if (!isRunning) { const s = parseFloat(stake) || 1.00; setCurrentStake(s); currentStakeRef.current = s } }, [stake, isRunning])

  useEffect(() => {
    if (!token || !accountId) return
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isRunningRef.current) {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          reconnectAttemptsRef.current = 0
          connectWS()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    
    const connectWS = async () => {
      try {
        const response = await fetch(`https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } })
        const data = await response.json()
        if (!data.data?.url) throw new Error('No WebSocket URL')
        if (wsRef.current) wsRef.current.close()
        const ws = new WebSocket(data.data.url)
        wsRef.current = ws
        ws.onopen = () => { ws.send(JSON.stringify({ balance: 1, subscribe: 1, req_id: reqIdRef.current++ })); 
          reconnectAttemptsRef.current = 0
          if(isRunningRef.current) addLog('✅ Connection Restored')
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
                lastLiveAtRef.current[symbol] = Date.now()
                liveTickCountRef.current[symbol] = (liveTickCountRef.current[symbol] || 0) + 1
              }
              const paperSettled = advancePaperTrials(symbol, { quote: msg.tick.quote, pipSize: msg.tick.pip_size })
              paperSettled.forEach(row => addLog(`🧪 Forward sample settled: ${row.won ? 'WIN' : 'LOSS'} on ${symbol}; ${row.option} after ${row.duration} ticks.`))
              if (paperSettled.length && isRunningRef.current) addLog('🧪 Forward calibration updated; the next scan will recheck its confidence bound.')
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
          if (researchTimerRef.current) { clearInterval(researchTimerRef.current); researchTimerRef.current = null }
          if (isRunningRef.current) {
            reconnectAttemptsRef.current++
            const delay = Math.min(3000 * reconnectAttemptsRef.current, 30000)
            setTimeout(connectWS, delay)
            if (reconnectAttemptsRef.current >= 20) {
              addLog('❌ Max reconnection attempts reached. Stopping bot.')
              setIsRunning(false); isRunningRef.current = false
            }
          }
        }
      } catch (err) { addLog(`❌ Connection failed`) }
    }
    connectWS()
    return () => { 
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
      const finish = () => { if (finished) return; finished = true; historyLoadedRef.current = true; historyLoadInFlightRef.current = false; resolve() }
      const totalMarkets = UNIQUE_MARKETS.length
      const checkDone = () => { loadedCount++; if (loadedCount >= totalMarkets) finish() }
      UNIQUE_MARKETS.forEach(([,sym]) => {
        const reqId = reqIdRef.current++
        const onMessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (msg.req_id === reqId && msg.msg_type === 'history') {
              wsRef.current.removeEventListener('message', onMessage)
              checkDone()
            }
          } catch (e) {}
        }
        wsRef.current.addEventListener('message', onMessage)
        wsRef.current.send(JSON.stringify({ ticks_history: sym, count: 250, end: 'latest', style: 'ticks', subscribe: 1, req_id: reqId }))
      })
      setTimeout(finish, 4000)
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
      name, symbol, prices: tickDataRef.current[symbol] || [],
      lastLiveAt: lastLiveAtRef.current[symbol] || 0,
      liveTicks: liveTickCountRef.current[symbol] || 0
    }))
    const selectedConfig = researchConfigRef.current
    const universe = await rankLiveStrategyUniverse(markets, selectedConfig, { now: Date.now(), maxAgeMs: 5000, minLiveTicks: 1 })
    // Research all supported profiles, but only the exact user-selected profile
    // is eligible to enter the bot's existing validation/execution path.
    const now = Date.now()
    const freshMarketCount = markets.filter(m => m.lastLiveAt && now - m.lastLiveAt >= 0 && now - m.lastLiveAt <= 5000 && Number(m.liveTicks) >= 1).length
    setResearchMarketCount(freshMarketCount)
    if (universe[0]) { setBestMarket(universe[0].marketName); setConfluenceScore(universe[0].score) }
    if (performanceCooldownUntilRef.current > now) {
      latestResearchRef.current = { updatedAt: now, candidates: [], marketCount: freshMarketCount }
      return []
    }
    const requiredScore = performanceRecoveryUntilRef.current > now ? 92 : consecutiveLossesRef.current >= 3 ? 92 : consecutiveLossesRef.current >= 2 ? 90 : consecutiveLossesRef.current === 1 ? 85 : 0
    const eligible = universe.filter(item => {
      const adaptive = getAdaptiveStrategyStatus(item.signal || { ...item.profile, option: item.signal?.option || option, predictedDigit: Number(predictedDigit) }, now)
      return !adaptive.blocked
      && item.profile.tradeType === selectedConfig.tradeType
      && item.profile.subTradeType === (selectedConfig.subTradeType || '')
      && item.profile.timeframeUnit === selectedConfig.timeframeUnit
      && Number(item.profile.duration) === Number(selectedConfig.duration)
      && item.qualified === true
      && (marketCooldownUntilRef.current[item.symbol] || 0) <= now
      && Number(item.score || 0) >= requiredScore
    })
    latestResearchRef.current = { updatedAt: now, candidates: eligible, marketCount: freshMarketCount }
    return eligible
  }

  const refreshResearch = async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !historyLoadedRef.current || researchInFlightRef.current) return
    researchInFlightRef.current = true
    try { await scanMarkets() }
    catch (error) { addLog(`Parallel market research error: ${error.message}`) }
    finally { researchInFlightRef.current = false }
  }

  // The 13 live subscriptions and ranking loop are independent of trade execution.
  useEffect(() => {
    let active = true
    const ensureResearch = async () => {
      if (!active || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
      if (!historyLoadedRef.current) await loadAllHistory()
      if (!active || !historyLoadedRef.current || researchTimerRef.current) return
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
    if (!historyLoadedRef.current) { addLog(' Analyzing unique volatility markets...'); await loadAllHistory() }

    while (isRunningRef.current) {
      try {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) { await new Promise(r => setTimeout(r, 3000)); continue }
        
        // Consume the latest independently refreshed research snapshot. A stale
        // snapshot is never used for entry; the next parallel pass refreshes it.
        const researchSnapshot = latestResearchRef.current
        const refreshedQueue = Date.now() - researchSnapshot.updatedAt <= 2500 ? researchSnapshot.candidates : []
        const currentTarget = refreshedQueue[0]
        if (!currentTarget) {
          if (performanceCooldownUntilRef.current > Date.now()) {
            if (lastPerformancePauseNoticeRef.current !== performanceCooldownUntilRef.current) {
              const remaining = Math.ceil((performanceCooldownUntilRef.current - Date.now()) / 1000)
              addLog(`🛡️ Performance circuit breaker: no new entries for ${remaining}s after the last 8 settled trades were net negative.`)
              lastPerformancePauseNoticeRef.current = performanceCooldownUntilRef.current
            }
            await new Promise(r => setTimeout(r, Math.min(5000, Math.max(500, performanceCooldownUntilRef.current - Date.now()))))
          } else {
            if (!hasLoggedScanningRef.current) {
              addLog('Thamira is comparing live market, strategy and duration candidates; watch-only patterns are not sent as trades.')
              hasLoggedScanningRef.current = true
            }
            await new Promise(r => setTimeout(r, 1000))
          }
          continue
        }
        hasLoggedScanningRef.current = false
        const signal = {
          ...currentTarget.signal,
          growthRate: 0.01, multiplier: 100, takeProfit: 1, contractStopLoss: 1
        }
        const accountRisk = evaluateAccountRisk({ balance: accountBalanceRef.current, sessionPL: sessionPLRef.current, targetProfit, stopLoss, nextStake: currentStakeRef.current })
        if (!accountRisk.allowEntry) {
          if (accountRisk.balanceUnavailable) { addLog('⏳ Waiting for Deriv to confirm account balance before entry.'); await new Promise(resolve => setTimeout(resolve, 1000)); continue }
          addLog(`🛡️ Account guard: ${accountRisk.message}. New entries stopped.`); isRunningRef.current = false; setIsRunning(false); break
        }
        const adaptiveStatus = getAdaptiveStrategyStatus(signal)
        if (adaptiveStatus.blocked) { addLog(`🧠 Strategy recovery pause: ${signal.tradeType}/${signal.subTradeType}/${signal.option} has ${adaptiveStatus.consecutiveLosses} consecutive losses across markets.`); await new Promise(r => setTimeout(r, Math.max(500, adaptiveStatus.blockedUntil - Date.now()))); continue }
        const tradeDirection = signal.option
        lastResearchNoticeRef.current = ''
        setBestMarket(currentTarget.marketName); setConfluenceScore(currentTarget.score)
        addLog(`🎯 SELECTED CANDIDATE: ${currentTarget.marketName} | Relative setup score: ${currentTarget.score}/94 (not win probability) | Direction: ${tradeDirection}`)
        addLog('🔎 Requesting and validating the exact contract quote; no purchase has been sent yet.')
        const proposalReq = buildProposal(signal, roundStake(currentStakeRef.current))
        const executionStartedAt = performance.now()
        // The proposal request itself validates the exact contract mapping; avoid a
        // separate contracts_for round trip that would add avoidable entry latency.
        const proposalRes = await wsRequest(proposalReq)
        if (!isRunningRef.current) break
        if (signal.tradeType === 'Digits' && signal.timeframeUnit === 'Ticks') {
          const calibration = getPaperForwardSummary(signal)
          if (!calibration.calibrated) {
            const started = beginPaperTrial({ ...signal, id: `paper-${signal.symbol}-${Date.now()}` }, {
              quote: { askPrice: proposalRes.proposal.ask_price, payout: proposalRes.proposal.payout,
                currency: proposalRes.proposal.currency, quotedAt: Date.now() }
            })
            if (started) {
              const difficulty = getContractDifficulty(signal)
              addLog(`🧪 Calibration-only trial started for ${signal.subTradeType}/${signal.option} on ${signal.symbol}; theoretical baseline ${difficulty.theoreticalWinChance === null ? 'n/a' : (difficulty.theoreticalWinChance * 100).toFixed(1) + '%'}; exact profile barrier ${signal.predictedDigit ?? 'n/a'}, duration ${signal.duration} ${signal.timeframeUnit}; ${calibration.wins}/${calibration.trades} wins, ${calibration.trades}/200 settled samples, 70% observed-win target plus quote break-even confidence required; no purchase sent.`)
            } else if (calibration.pending === 0) {
              addLog('🛡️ No valid quote-matched calibration trial could be started; refusing this digit entry and retrying after a fresh quote.')
              await new Promise(resolve => setTimeout(resolve, 1500))
              continue
            }
            const waitUntil = Date.now() + Math.max(15000, Number(signal.duration) * 5000)
            while (isRunningRef.current && getPaperForwardSummary(signal).pending > 0 && Date.now() < waitUntil) {
              await new Promise(resolve => setTimeout(resolve, 250))
            }
            const updated = getPaperForwardSummary(signal)
            if (updated.pending > 0) {
              addLog(`⏳ Waiting for live ticks to settle the calibration sample (${updated.pending} pending).`)
            } else {
              addLog(`🧪 PAPER calibration only: ${updated.wins}/${updated.trades} wins (${updated.trades}/200 required); observed break-even ${updated.maxBreakEvenRate === null ? 'n/a' : (updated.maxBreakEvenRate * 100).toFixed(1) + '%'}; conservative lower bound ${updated.lowerBound === null ? 'n/a' : (updated.lowerBound * 100).toFixed(1) + '%'}; ${updated.calibrated ? 'qualified' : 'not qualified; no real purchase sent'}.`)
            }
            continue
          }
        }
        const marketSnapshot = {
          prices: tickDataRef.current[currentTarget.symbol] || [],
          lastLiveAt: lastLiveAtRef.current[currentTarget.symbol] || 0
        }
        const liveCheck = validateLiveOpportunity(signal, marketSnapshot, { now: Date.now(), maxSignalAgeMs: 1500 })
        if (!liveCheck.valid) {
          addLog(`Entry rejected after quote: ${liveCheck.reason} No purchase sent; returning to live ranking.`)
          continue
        }
        const entryCheck = validateEntryWindow(signal, { maxSignalAgeMs: 1500, proposalBudgetMs: 300, minimumRemainingMs: 250 })
        if (!entryCheck.valid) { addLog(`Entry expired before purchase: ${entryCheck.reason}`); continue }
        addLog(`Execution checks passed in ${Math.round(performance.now() - executionStartedAt)}ms; live price drift ${liveCheck.drift.toPrecision(4)}. Sending purchase request now.`)
        const buyRes = await wsRequest({ buy: proposalRes.proposal.id, price: proposalRes.proposal.ask_price })
        if (!isRunningRef.current) break
        addLog(`🚀 PURCHASE CONFIRMED by Deriv | Contract: ${buyRes.buy.contract_id}`)
        
        const contractResult = await monitorContract(buyRes.buy.contract_id); if (!contractResult) break
        const profit = parseFloat(contractResult.profit || 0); const isWin = profit > 0
        const outcomeStats = recordContractOutcome(signal, { profit, stake: currentStakeRef.current, contractId: contractResult.contract_id, bot: 'Automated Bot' })
        const adaptiveStats = recordAdaptiveOutcome(signal, { profit, stake: currentStakeRef.current, bot: 'Automated Bot' })
        addLog(`🧠 Strategy profile: ${adaptiveStats.consecutiveLosses} consecutive losses across markets; ${adaptiveStats.trades} recent outcomes; win rate ${adaptiveStats.winRate === null ? 'n/a' : (adaptiveStats.winRate * 100).toFixed(1) + '%'} (70% target).`)
        if (outcomeStats) addLog(`Thamira history: ${outcomeStats.trades} settled for this exact setup; win rate ${outcomeStats.winRate === null ? 'n/a' : (outcomeStats.winRate * 100).toFixed(1) + '%'}.`)
        totalTradesRef.current += 1; sessionPLRef.current += profit
        recentOutcomesRef.current = [...recentOutcomesRef.current, profit].slice(-8)
        if (recentOutcomesRef.current.length === 8 && recentOutcomesRef.current.reduce((sum, value) => sum + value, 0) <= 0) {
          performanceCooldownUntilRef.current = Date.now() + 180000
          performanceRecoveryUntilRef.current = Date.now() + 480000
          addLog('🛡️ Eight-trade performance guard: the latest 8 settled contracts are net negative. Pausing entries for 3 minutes; then require 92/94 setup scores for 5 minutes.')
        }
        
        if (isWin) {
          winsRef.current += 1; currentStakeRef.current = parseFloat(stake)
          consecutiveLossesRef.current = 0
    lastResearchNoticeRef.current = ''
          setCurrentStake(currentStakeRef.current)
          addLog(`✅ WON +$${profit.toFixed(2)} | Stake reset to base`)
        } else {
          lossesRef.current += 1; consecutiveLossesRef.current++
          currentStakeRef.current = boundedNextStake(stake, currentStakeRef.current, martingaleFactor, consecutiveLossesRef.current)
          marketCooldownUntilRef.current[currentTarget.symbol] = Date.now() + (consecutiveLossesRef.current >= 2 ? 120000 : 60000)
          setCurrentStake(currentStakeRef.current)
          addLog(`❌ LOST -${profit.toFixed(2)} | Bounded recovery stake ${currentStakeRef.current.toFixed(2)}; ${currentTarget.symbol} paused for ${consecutiveLossesRef.current >= 2 ? 120 : 60}s.`)
          if (consecutiveLossesRef.current >= 2) addLog(`🛡️ ${consecutiveLossesRef.current} consecutive losses: next setup must score at least ${consecutiveLossesRef.current >= 3 ? 92 : 90}/94.`)
        }
        
        setTotalTrades(totalTradesRef.current); setWins(winsRef.current); setLosses(lossesRef.current); setCurrentPL(sessionPLRef.current)
        if (sessionPLRef.current >= parseFloat(targetProfit)) { addLog(`🎯 TARGET HIT! $${sessionPLRef.current.toFixed(2)}`); setIsRunning(false); isRunningRef.current = false; break }
        if (sessionPLRef.current <= -parseFloat(stopLoss)) { addLog('🛑 STOP LOSS HIT!'); setIsRunning(false); isRunningRef.current = false; break }
        addLog(`📊 P/L: ${sessionPLRef.current.toFixed(2)} | Trades: ${totalTradesRef.current}`)
        if (consecutiveLossesRef.current >= 4) {
          addLog('🛑 Four consecutive losses: Automated Bot safety stop. Review the session before restarting.')
          setIsRunning(false); isRunningRef.current = false; break
        }
        const cooldownMs = consecutiveLossesRef.current >= 3 ? 90000 : consecutiveLossesRef.current >= 2 ? 45000 : consecutiveLossesRef.current === 1 ? 15000 : 5000
        addLog(`🧊 Waiting ${Math.round(cooldownMs / 1000)}s before the next independent market scan.`)
        await new Promise(r => setTimeout(r, cooldownMs))
      } catch (error) { if (!isRunningRef.current) break; addLog(`❌ Error: ${error.message}`); await new Promise(r => setTimeout(r, 2000)) }
    }
    researchInFlightRef.current = false
  }

  const startBot = () => {
    setValidationError(''); if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) { setValidationError('Not connected.'); return }
    isRunningRef.current = true; setIsRunning(true); sessionPLRef.current = 0; totalTradesRef.current = 0; winsRef.current = 0; lossesRef.current = 0
    currentStakeRef.current = parseFloat(stake); hasLoggedScanningRef.current = false; reconnectAttemptsRef.current = 0
    consecutiveLossesRef.current = 0; recentOutcomesRef.current = []; performanceCooldownUntilRef.current = 0; performanceRecoveryUntilRef.current = 0; lastPerformancePauseNoticeRef.current = 0
    setCurrentPL(0); setTotalTrades(0); setWins(0); setLosses(0); setCurrentStake(parseFloat(stake)); setConfluenceScore(0); marketCooldownUntilRef.current = {}
    addLog('⚡ AUTOMATED BOT ACTIVATED (13 Markets | Loss-Resistant Entry Gates)'); addLog(`Type: ${tradeType} | Stake: ${stake} | Recovery: adaptive strategy guard + bounded martingale`); addLog(`Target: $${targetProfit} | Stop: $${stopLoss}`); runTradeCycle()
  }

  const stopBot = () => { isRunningRef.current = false; setIsRunning(false); if (researchTimerRef.current) { clearInterval(researchTimerRef.current); researchTimerRef.current = null } addLog('⏹️ Stopped new entries and parallel market research; any open contract remains monitored until settlement.') }
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
  <div className="mb-1 flex justify-between items-center bg-black/50 rounded p-1"><span className="text-[9px] text-gray-400">Live research:</span><span className="text-[10px] text-green-400 font-bold">{researchMarketCount}/13 markets</span></div>
  <div className="mb-1 flex justify-between items-center bg-black/50 rounded p-1"><span className="text-[9px] text-gray-400">Best Market:</span><span className="text-[10px] text-orange-400 font-bold">{bestMarket}</span></div>
  <div className="mb-1 flex justify-between items-center bg-black/50 rounded p-1"><span className="text-[9px] text-gray-400">Confluence Score:</span><span className={`text-[10px] font-bold ${confluenceScore >= 70 ? 'text-green-400' : 'text-orange-400'}`}>{confluenceScore.toFixed(0)}%</span></div>
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
 