import { useState, useRef, useEffect } from 'react'
import { Play, Square, RefreshCw, Terminal, AlertCircle, TrendingUp, Target, ShieldCheck, Activity, Lock } from 'lucide-react'
import { buildProposal, MARKET_SYMBOLS, VOLATILITY_MARKETS } from '../services/tradingCore'
import { evaluateStrategyEnsemble, validateEntryWindow } from '../services/strategyIntelligence'
import { recordContractOutcome } from '../services/contractOutcomeIntelligence'

const VOLATILITY_INDICES = ['Volatility 10 (1s) Index', 'Volatility 10 Index', 'Volatility 15 (1s) Index', 'Volatility 25 (1s) Index', 'Volatility 25 Index', 'Volatility 30 (1s) Index', 'Volatility 50 (1s) Index', 'Volatility 50 Index', 'Volatility 75 (1s) Index', 'Volatility 75 Index', 'Volatility 90 (1s) Index', 'Volatility 100 (1s) Index', 'Volatility 100 Index']
const SYMBOL_MAP = Object.fromEntries(VOLATILITY_MARKETS)
const TRADE_TYPES = ['Multipliers', 'Ups & Downs', 'Touch & No Touch', 'Digits', 'Accumulators', 'Vanillas', 'Turbos']
const SUB_TRADE_TYPES = { 'Accumulators': [], 'Vanillas': ['Call/Put'], 'Turbos': ['Turbos'], 'Multipliers': ['Multipliers'], 'Ups & Downs': ['Rise/Fall', 'Higher/Lower'], 'Touch & No Touch': ['Touch/No Touch'], 'Digits': ['Over/Under', 'Matches/Differs', 'Even/Odd'] }
const OPTIONS = { 'Over/Under': ['Over', 'Under', 'Both'], 'Even/Odd': ['Even', 'Odd', 'Both'], 'Matches/Differs': ['Matches', 'Differs', 'Both'], 'Turbos': ['Up', 'Down', 'Both'], 'Rise/Fall': ['Rise', 'Fall', 'Both'], 'Higher/Lower': ['Higher', 'Lower', 'Both'], 'Touch/No Touch': ['Touch', 'No Touch', 'Both'], 'Call/Put': ['Call', 'Put', 'Both'], 'Multipliers': ['Up', 'Down', 'Both'] }
const TIMEFRAME_RULES = { 'Accumulators': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 85, fixed: true, label: '1 - 85 ticks' }, 'Multipliers': { units: ['Auto'], defaultUnit: 'Auto', min: 1, max: 1, fixed: true, label: 'Auto' }, 'Digits': { units: ['Ticks'], defaultUnit: 'Ticks', min: 1, max: 10, fixed: false }, 'Turbos': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false }, 'Ups & Downs': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false }, 'Touch & No Touch': { units: ['Ticks', 'Minutes'], defaultUnit: 'Ticks', min: 1, maxMap: { 'Ticks': 10, 'Minutes': 1440 }, fixed: false }, 'Vanillas': { units: ['Minutes', 'Hours', 'Days'], defaultUnit: 'Minutes', min: 1, maxMap: { 'Minutes': 1440, 'Hours': 24, 'Days': 30 }, fixed: false } }

const getQuoteDigit = value => { const text=String(value); const decimals=text.includes('.')?text.split('.')[1]:''; return Number((decimals||text).slice(-1)) }
const MARKET_LABEL_BY_SYMBOL = Object.fromEntries(Object.entries(SYMBOL_MAP).map(([label,symbol])=>[symbol,label]))

export default function AutoDAI({ token, accountId, onBalanceUpdate }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [selectedMarket, setSelectedMarket] = useState('Volatility 100 (1s) Index')
  const [tradeType, setTradeType] = useState('Digits')
  const [subTradeType, setSubTradeType] = useState('Over/Under')
  const [option, setOption] = useState('Over')
  const [predictedDigit, setPredictedDigit] = useState('5')
  const [timeframeUnit, setTimeframeUnit] = useState('Ticks')
  const [durationValue, setDurationValue] = useState(1)
  const [stake, setStake] = useState('0.35')
  const [targetProfit, setTargetProfit] = useState('20.00')
  const [stopLoss, setStopLoss] = useState('10.00')
  const [isRunning, setIsRunning] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [logs, setLogs] = useState(() => { try { return JSON.parse(localStorage.getItem('mwathe:autod-ai-logs:v1') || 'null') || ['AI Core initialized.'] } catch { return ['AI Core initialized.'] } })
  const [currentPL, setCurrentPL] = useState(0.00)
  const [totalTrades, setTotalTrades] = useState(0)
  const [wins, setWins] = useState(0)
  const [losses, setLosses] = useState(0)
  const [currentStake, setCurrentStake] = useState(0.35)
  const [consecutiveLosses, setConsecutiveLosses] = useState(0)
  const [ws, setWs] = useState(null)
  const [currentContract, setCurrentContract] = useState(null)

  const logRef = useRef(null)
  const shouldAutoScrollRef = useRef(true)
  const accountCurrencyRef = useRef('USD')
  const marketCooldownUntilRef = useRef({})
  const recentOutcomesRef = useRef([])
  const performanceCooldownUntilRef = useRef(0)
  const performanceRecoveryUntilRef = useRef(0)
  const lastPerformancePauseNoticeRef = useRef(0)
  const nextTradeTimer = useRef(null)
  const isRunningRef = useRef(false)
  const wsRef = useRef(null)
  const tickHistoryRef = useRef({})
  const pendingProposalRef = useRef(null)
  const pendingEntryRef = useRef(null)
  const contractUnavailableUntilRef = useRef({})
  const sessionRef = useRef({totalTrades:0,wins:0,losses:0,lossStreak:0,stake:0.35,pl:0})
  const configRef = useRef({stake,targetProfit,stopLoss})
  configRef.current = {stake,targetProfit,stopLoss,selectedMarket,tradeType,subTradeType,option,predictedDigit,timeframeUnit,durationValue}


  const addLog = (msg) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-2000))
  useEffect(() => { try { localStorage.setItem('mwathe:autod-ai-logs:v1', JSON.stringify(logs)) } catch {} }, [logs])
  useEffect(() => { if (logRef.current && shouldAutoScrollRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [logs])
  useEffect(() => { if (SUB_TRADE_TYPES[tradeType]?.length > 0) setSubTradeType(SUB_TRADE_TYPES[tradeType][0]); else setSubTradeType('') }, [tradeType])
  useEffect(() => { if (subTradeType && OPTIONS[subTradeType]) setOption(OPTIONS[subTradeType][0]) }, [subTradeType])
  useEffect(() => { const rules = TIMEFRAME_RULES[tradeType]; setTimeframeUnit(rules.defaultUnit); setDurationValue(rules.min) }, [tradeType])
  useEffect(() => { if (!isRunning) setCurrentStake(parseFloat(stake) || 0.35) }, [stake, isRunning])

  const handleLogin = async () => { setPasswordError(''); try { const response = await fetch('/api/autod-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }); const result = await response.json(); if (!response.ok || !result.authenticated) throw new Error(result.error || 'Authentication failed'); setIsAuthenticated(true); setPassword('') } catch (error) { setPasswordError(error.message || 'Authentication failed') } }

  useEffect(() => {
    if (!isAuthenticated || !token || !accountId) return
    const connectWS = async () => {
      try {
        const response = await fetch(`https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } })
        const data = await response.json()
        const wsUrl = data.data?.url
        if (!wsUrl) throw new Error('No WebSocket URL')
        const websocket = new WebSocket(wsUrl)
        wsRef.current = websocket
        websocket.onopen = () => { addLog('✅ AI Connected to Deriv'); websocket.send(JSON.stringify({ balance: 1, subscribe: 1, req_id: 1 })) }
        websocket.onmessage = (message) => {
          try {
            const msg = JSON.parse(message.data)
            if (msg.msg_type === 'balance' && msg.balance?.currency) accountCurrencyRef.current = msg.balance.currency
            if (msg.msg_type === 'balance' && onBalanceUpdate) onBalanceUpdate(parseFloat(msg.balance.balance))
            if (msg.msg_type === 'history' && msg.history?.prices) { const symbol = msg.echo_req?.ticks_history || msg.history.symbol; if (symbol) tickHistoryRef.current[symbol] = msg.history.prices.map(Number).filter(Number.isFinite).slice(-500) }
            if (msg.msg_type === 'tick' && msg.tick?.quote !== undefined) { const symbol = msg.tick.symbol; const current = tickHistoryRef.current[symbol] || []; tickHistoryRef.current[symbol] = [...current, Number(msg.tick.quote)].slice(-500) }
            if (msg.msg_type === 'contracts_for' && pendingProposalRef.current?.reqId === msg.req_id) {
              const pending = pendingProposalRef.current; pendingProposalRef.current = null
              const offered = Array.isArray(msg.contracts_for?.available) ? msg.contracts_for.available : []
              const offeredTypes = offered.map(item => item.contract_type).filter(Boolean)
              const exactContractAvailable = offeredTypes.includes(pending.proposal.contract_type)
              if (msg.error || !exactContractAvailable) {
                const rejectedSymbol = pending.proposal.underlying_symbol
                contractUnavailableUntilRef.current[rejectedSymbol] = Date.now() + 60000
                pendingEntryRef.current = null
                const reason = msg.error?.message || (offeredTypes.length ? `available: ${offeredTypes.join(', ')}` : 'Deriv returned no available contracts')
                addLog(`⛔ ${pending.proposal.contract_type} unavailable on ${rejectedSymbol} (${reason}). Skipping this market for 60s; no order sent.`)
                if (isRunningRef.current) nextTradeTimer.current = setTimeout(() => executeTrade(), 300)
              } else {
                websocket.send(JSON.stringify({...pending.proposal,req_id:Date.now()}))
              }
            }
            if (msg.msg_type === 'proposal') { if (msg.error) { addLog(`❌ Proposal failed: ${msg.error.message || 'Deriv rejected the proposal'}`); if (isRunningRef.current) nextTradeTimer.current=setTimeout(()=>executeTrade(),3000) } else setTimeout(() => { const gate=validateEntryWindow(pendingEntryRef.current,{maxSignalAgeMs:15000,proposalBudgetMs:300,minimumRemainingMs:250}); if(!gate.valid){addLog(`⛔ Entry expired before purchase: ${gate.reason}`);pendingEntryRef.current=null;if(isRunningRef.current)nextTradeTimer.current=setTimeout(()=>executeTrade(),1500);return} websocket.send(JSON.stringify({ buy: msg.proposal.id, price: msg.proposal.ask_price, req_id: Date.now() })) }, 200) }
            if (msg.msg_type === 'buy') { if (msg.error) { addLog(`❌ Buy failed: ${msg.error.message || 'Deriv rejected the purchase'}`); setCurrentContract(null); if (isRunningRef.current) nextTradeTimer.current=setTimeout(()=>executeTrade(),3000) } else { setCurrentContract({ id: msg.buy.contract_id }); addLog(`✅ Contract: ${msg.buy.contract_id}`); websocket.send(JSON.stringify({ proposal_open_contract: 1, contract_id: msg.buy.contract_id, subscribe: 1, req_id: Date.now() })) } }
            if (msg.msg_type === 'proposal_open_contract') { if (!msg.error && msg.proposal_open_contract) { const contract = msg.proposal_open_contract; if (contract.is_sold) { handleContractResult(parseFloat(contract.profit)); setCurrentContract(null) } else setCurrentPL(parseFloat(contract.profit || 0)) } }
          } catch (e) { console.error(e) }
        }
        websocket.onerror = () => addLog('❌ WS Error')
        websocket.onclose = () => addLog('🔌 Disconnected')
        setWs(websocket)
      } catch (err) { addLog(`❌ Connection failed`) }
    }
    connectWS()
    return () => { if (wsRef.current) { wsRef.current.close(); wsRef.current = null } }
  }, [isAuthenticated, token, accountId])

  const executeTrade = async () => {
    const socket = wsRef.current
    const config = configRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN || !isRunningRef.current) return
    const now = Date.now()
    if (performanceCooldownUntilRef.current > now) {
      if (lastPerformancePauseNoticeRef.current !== performanceCooldownUntilRef.current) {
        addLog(`🛡️ Performance circuit breaker: no new entries for ${Math.ceil((performanceCooldownUntilRef.current-now)/1000)}s after the last 8 settled trades were net negative.`)
        lastPerformancePauseNoticeRef.current = performanceCooldownUntilRef.current
      }
      nextTradeTimer.current = setTimeout(() => executeTrade(), Math.min(5000, Math.max(500, performanceCooldownUntilRef.current-now)))
      return
    }
    const requiredScore = performanceRecoveryUntilRef.current > now ? 6.5 : sessionRef.current.lossStreak >= 3 ? 6.5 : sessionRef.current.lossStreak >= 2 ? 5 : sessionRef.current.lossStreak === 1 ? 4.5 : 3
    // Thamira evaluates the same contract-specific strategy ensemble on every
    // live market. Historical ticks seed the model; current subscribed ticks keep
    // each market window fresh. Relative scores rank markets, not win probabilities.
    const candidates = (await Promise.all(MARKET_SYMBOLS
      .filter(symbol => (contractUnavailableUntilRef.current[symbol] || 0) <= now
        && (marketCooldownUntilRef.current[symbol] || 0) <= now)
      .map(async symbol => {
        const ticks = tickHistoryRef.current[symbol] || []
        const report = await evaluateStrategyEnsemble(ticks, {
          tradeType: config.tradeType, subTradeType: config.subTradeType,
          option: config.option, predictedDigit: Number(config.predictedDigit),
          duration: config.durationValue, timeframeUnit: config.timeframeUnit, symbol
        })
        const candidate = report.candidate || report.watchCandidate
        if (!candidate) return null
        const prices = ticks.slice(-21)
        const moves = prices.slice(1).map((value, index) => value - prices[index])
        const atr = moves.reduce((sum, value) => sum + Math.abs(value), 0) / Math.max(1, moves.length)
        return { symbol, ticks, atr, drift: ticks.at(-1) - ticks.at(-16), score: candidate.score,
          report, option: candidate.option, qualified: Boolean(report.candidate) }
      }))).filter(Boolean).sort((a,b) => b.score - a.score)

    const executableCandidates = candidates.filter(item => item.qualified)
    if (!executableCandidates.length) {
      const watch = candidates[0]
      addLog(watch
        ? `Thamira watchlist leader: ${MARKET_LABEL_BY_SYMBOL[watch.symbol] || watch.symbol}, ${watch.option}, relative score ${watch.score}/94. Not execution-qualified: ${watch.report.reasons?.[0] || 'insufficient validation'}.`
        : 'Thamira is refreshing all 13 market windows; no evaluable candidate is ready yet.')
      nextTradeTimer.current=setTimeout(()=>executeTrade(),1000)
      return
    }
    const best = executableCandidates[0]
    const ticks = best.ticks, atr = best.atr, drift = best.drift, symbol = best.symbol
    const marketLabel = MARKET_LABEL_BY_SYMBOL[symbol] || symbol
    setSelectedMarket(marketLabel)
    addLog(`Thamira selected ${marketLabel} (${symbol}); best relative setup score ${best.score}/94; families: ${best.report.candidate.supportingFamilies.join(', ')}.`)
    const direction = drift > 0 ? 'up' : drift < 0 ? 'down' : 'flat'
    let selectedOption = config.option === 'Both' ? best.option : config.option
    const target = config.subTradeType === 'Over/Under' ? Math.max(1, Math.min(8, Number(config.predictedDigit) || 5)) : Math.max(0, Math.min(9, Number(config.predictedDigit) || 0))
    const isDown = ['Fall','Lower','Down','Put','No Touch','Under','Odd','Differs'].includes(selectedOption)
    if (config.tradeType !== 'Digits' && config.tradeType !== 'Accumulators' && config.tradeType !== 'Touch & No Touch' && ((direction==='up' && isDown) || (direction==='down' && !isDown))) {
      addLog('Selected direction conflicts with current tick trend; no trade sent.')
      nextTradeTimer.current = setTimeout(() => executeTrade(), 500)
      return
    }

    const barrier = config.tradeType === 'Digits' ? (config.subTradeType==='Over/Under'||config.subTradeType==='Matches/Differs'?String(target):'')
      : (config.tradeType==='Touch & No Touch'||config.subTradeType==='Higher/Lower') ? ((config.tradeType==='Touch & No Touch'?direction==='down':isDown)?'-':'+')+Math.max(atr*(config.tradeType==='Touch & No Touch'?3:2),Math.abs(ticks.at(-1))*0.0001).toFixed(4) : ''
    try {
      const signal = {symbol,tradeType:config.tradeType,subTradeType:config.subTradeType,option:selectedOption,predictedDigit:target,barrier,duration:config.durationValue,timeframeUnit:config.timeframeUnit,createdAt:Date.now(),expiryEpoch:Math.floor(Date.now()/1000)+Math.max(60,config.durationValue*(config.timeframeUnit==='Hours'?3600:config.timeframeUnit==='Days'?86400:config.timeframeUnit==='Minutes'?60:1)),growthRate:0.01,multiplier:100,takeProfit:1,contractStopLoss:1}
      const proposal = buildProposal(signal,sessionRef.current.stake,accountCurrencyRef.current)
      const reqId = Date.now()
      pendingProposalRef.current = {proposal,reqId}; pendingEntryRef.current = signal
      addLog(`🔎 Live setup ${selectedOption}; validating ${proposal.contract_type} with Deriv.`)
      socket.send(JSON.stringify({contracts_for:symbol,req_id:reqId}))
    } catch (error) { addLog(`⛔ ${error.message}`); nextTradeTimer.current = setTimeout(() => executeTrade(), 3000) }
  }

  const handleContractResult = (profit) => {
    const session = sessionRef.current
    const config = configRef.current
    session.totalTrades += 1
    const settledSignal = pendingEntryRef.current || {}
    const outcomeStats = recordContractOutcome(settledSignal, { profit, stake: session.stake, contractId: currentContract?.id, bot: 'AutoD AI' })
    if (outcomeStats) addLog(`Thamira history: ${outcomeStats.trades} settled for this exact setup; win rate ${outcomeStats.winRate === null ? 'n/a' : (outcomeStats.winRate * 100).toFixed(1) + '%'}.`)
    pendingEntryRef.current = null
    if (profit > 0) {
      session.wins += 1; session.lossStreak = 0; session.stake = parseFloat(config.stake) || 0.35
      addLog(`✅ AI WON +$${profit.toFixed(2)}`)
    } else {
      session.losses += 1; session.lossStreak += 1
      session.stake = parseFloat(config.stake) || 0.35
      const lostSymbol = settledSignal.symbol
      if (lostSymbol) marketCooldownUntilRef.current[lostSymbol] = Date.now() + (session.lossStreak >= 2 ? 120000 : 60000)
      addLog(`❌ AI LOST -${profit.toFixed(2)} | Base stake retained; no martingale escalation.`)
      if (session.lossStreak >= 2) addLog(`🛡️ Loss recovery: next setup requires scan score ${session.lossStreak >= 3 ? 6.5 : 5.0}+ and the losing market is cooling down.`)
    }
    session.pl += profit
    recentOutcomesRef.current = [...recentOutcomesRef.current, profit].slice(-8)
    if (recentOutcomesRef.current.length === 8 && recentOutcomesRef.current.reduce((sum,value)=>sum+value,0) <= 0) {
      performanceCooldownUntilRef.current = Date.now() + 180000
      performanceRecoveryUntilRef.current = Date.now() + 480000
      addLog('🛡️ Eight-trade performance guard: latest 8 settled contracts are net negative. Pausing entries for 3 minutes; then require scan score 6.5+ for 5 minutes.')
    }
    setTotalTrades(session.totalTrades);setWins(session.wins);setLosses(session.losses);setConsecutiveLosses(session.lossStreak);setCurrentStake(session.stake);setCurrentPL(session.pl)
    if (session.pl >= parseFloat(config.targetProfit)) { addLog(`🎯 Target hit! $${session.pl.toFixed(2)}`); setIsRunning(false); isRunningRef.current=false; return }
    if (session.pl <= -parseFloat(config.stopLoss)) { addLog(`🛑 Stop loss $${session.pl.toFixed(2)}`); setIsRunning(false); isRunningRef.current=false; return }
    if (session.lossStreak >= 4) { addLog('🛑 Four consecutive losses: AutoD AI safety stop. Review the session before restarting.'); setIsRunning(false); isRunningRef.current=false; return }
    if (isRunningRef.current) { const cooldownMs = session.lossStreak >= 3 ? 90000 : session.lossStreak >= 2 ? 45000 : session.lossStreak === 1 ? 15000 : 5000; addLog(`P/L: ${session.pl.toFixed(2)} | Trades: ${session.totalTrades}`); addLog(`🧊 Waiting ${Math.round(cooldownMs/1000)}s before next independent scan.`); nextTradeTimer.current=setTimeout(()=>executeTrade(),cooldownMs) }
  }

  const startBot = () => { setValidationError(''); if (!ws || ws.readyState !== WebSocket.OPEN) { setValidationError('Not connected.'); return }; if (nextTradeTimer.current) clearTimeout(nextTradeTimer.current); setIsRunning(true); isRunningRef.current = true; setCurrentPL(0); setTotalTrades(0); setWins(0); setLosses(0); setCurrentStake(parseFloat(stake)); setConsecutiveLosses(0); marketCooldownUntilRef.current={}; recentOutcomesRef.current=[]; performanceCooldownUntilRef.current=0; performanceRecoveryUntilRef.current=0; lastPerformancePauseNoticeRef.current=0; sessionRef.current={totalTrades:0,wins:0,losses:0,lossStreak:0,stake:parseFloat(stake),pl:0}; shouldAutoScrollRef.current=true; addLog(` AutoD AI Started`); addLog('Market: autonomous scan across volatility indices'); addLog(`Target: $${targetProfit} | Stop: $${stopLoss}`); tickHistoryRef.current={}; MARKET_SYMBOLS.forEach((symbol,index)=>ws.send(JSON.stringify({ ticks_history: symbol, count: 200, end: 'latest', style: 'ticks', subscribe: 1, req_id: Date.now()+index }))); nextTradeTimer.current = setTimeout(() => { if (isRunningRef.current) executeTrade() }, 3000) }
  const stopBot = () => { setIsRunning(false); isRunningRef.current = false; if (nextTradeTimer.current) { clearTimeout(nextTradeTimer.current); nextTradeTimer.current = null }; addLog(`⏹️ AI stopped new entries; any open contract remains monitored until settlement.`) }
  const resetBot = () => { if (isRunningRef.current) return; setLogs([]); try { localStorage.removeItem('mwathe:autod-ai-logs:v1') } catch {}; shouldAutoScrollRef.current=true; setValidationError('') }
  const rules = TIMEFRAME_RULES[tradeType]; const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0'
  if (!isAuthenticated) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-950 p-4">
        <div className="bg-gray-900 rounded-xl p-6 border border-orange-500/30 w-full max-w-sm">
          <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4"><Lock className="text-orange-500" size={32} /></div>
          <h2 className="text-xl font-bold text-white mb-2 text-center">AutoD AI Security</h2>
          <p className="text-gray-400 text-sm mb-6 text-center">Enter password to access AI core.</p>
          <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setPasswordError('') }} className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white text-center text-lg mb-3 focus:border-orange-500 outline-none" placeholder="Enter Password" />
          {passwordError && <p className="text-red-500 text-sm mb-3 text-center">{passwordError}</p>}
          <button onClick={handleLogin} className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-green-500 text-white font-bold">Unlock AI</button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-950 text-white p-2 overflow-hidden">
      <div className="flex items-center gap-2 pb-1 border-b border-gray-800 mb-2 flex-shrink-0"><div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-green-500 rounded-lg flex items-center justify-center"><Activity size={16} className="text-white" /></div><div><h2 className="text-base font-bold text-white">AutoD AI</h2><p className="text-[10px] text-gray-400 flex items-center gap-1"><ShieldCheck size={10} /> Risk-Limited Trading</p></div></div>
      {validationError && <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-2 mb-2 flex items-center gap-2 flex-shrink-0"><AlertCircle size={12} className="text-red-500" /><p className="text-red-400 text-[10px] font-medium">{validationError}</p></div>}
      <div className="bg-gray-900 rounded-lg p-2 border border-gray-800 mb-2 flex-shrink-0 overflow-y-auto" style={{maxHeight: '28vh'}}>
        <h3 className="text-white font-bold text-xs flex items-center gap-1 mb-2"><Target size={12} className="text-orange-500" /> Parameters</h3>
  
        <div className="grid grid-cols-2 gap-2 mb-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Type</label><select value={tradeType} onChange={e => setTradeType(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{TRADE_TYPES.map(t => <option key={t} className="text-white">{t}</option>)}</select></div>{SUB_TRADE_TYPES[tradeType]?.length > 0 && <div><label className="text-[10px] text-gray-400 uppercase font-bold">Sub Type</label><select value={subTradeType} onChange={e => setSubTradeType(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{SUB_TRADE_TYPES[tradeType].map(t => <option key={t} className="text-white">{t}</option>)}</select></div>}</div>
        {tradeType === 'Digits' && <div className="mb-2"><label className="text-[10px] text-gray-400 uppercase font-bold">Predicted Digit / Barrier (0–9)</label><input type="number" min={subTradeType === 'Over/Under' ? 1 : 0} max={subTradeType === 'Over/Under' ? 8 : 9} step="1" value={predictedDigit} onChange={e => setPredictedDigit(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div>}
        {subTradeType && OPTIONS[subTradeType] && <div className="mb-2"><label className="text-[10px] text-gray-400 uppercase font-bold mb-1 block">Option</label><div className="grid grid-cols-3 gap-1">{OPTIONS[subTradeType].map(opt => <button key={opt} onClick={() => setOption(opt)} disabled={isRunning} className={`py-1.5 rounded text-xs font-bold border ${option === opt ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-black border-gray-700 text-gray-400'}`}>{opt}</button>)}</div></div>}
        <div className="grid grid-cols-2 gap-2 mb-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Time</label>{rules.fixed ? <input type="text" value={rules.label} disabled className="w-full bg-black/50 border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-gray-500" /> : <select value={timeframeUnit} onChange={e => { setTimeframeUnit(e.target.value); setDurationValue(rules.min) }} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{rules.units.map(u => <option key={u} className="text-white">{u}</option>)}</select>}</div><div><label className="text-[10px] text-gray-400 uppercase font-bold">Duration</label><input type="number" value={durationValue} onChange={e => setDurationValue(parseInt(e.target.value) || 0)} disabled={isRunning || rules.fixed} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div></div>
        <div className="grid grid-cols-2 gap-2 mb-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Stake</label><input type="number" step="0.01" value={stake} onChange={e => setStake(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div><div><label className="text-[10px] text-gray-400 uppercase font-bold">Loss Recovery</label><input type="text" value="Flat stake · protected" disabled className="w-full bg-black/50 border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-green-400" /></div></div>
        <div className="grid grid-cols-2 gap-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Target</label><input type="number" step="0.01" value={targetProfit} onChange={e => setTargetProfit(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div><div><label className="text-[10px] text-gray-400 uppercase font-bold">Stop Loss</label><input type="number" step="0.01" value={stopLoss} onChange={e => setStopLoss(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div></div>
      </div>
      <div className="bg-gray-900 rounded-lg p-2 border border-green-500/30 mb-2 flex-shrink-0"><h3 className="text-white font-bold text-xs mb-1 flex items-center gap-1"><TrendingUp size={12} className="text-green-500" /> Performance</h3><div className="grid grid-cols-4 gap-1 text-center"><div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">P/L</p><p className={`font-bold text-xs ${currentPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>{currentPL >= 0 ? '+' : ''}{currentPL.toFixed(2)}</p></div><div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">Win Rate</p><p className="text-sky-400 font-bold text-xs">{winRate}%</p></div><div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">Trades</p><p className="text-white font-bold text-xs">{totalTrades}</p></div><div className="bg-black/50 rounded p-1"><p className="text-[9px] text-gray-400">Next</p><p className="text-orange-400 font-bold text-xs">{currentStake.toFixed(2)}</p></div></div></div>
      <div className="grid grid-cols-3 gap-2 flex-shrink-0 mb-2"><button onClick={startBot} disabled={isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${isRunning ? 'bg-gray-800 text-gray-500' : 'bg-green-500 text-black'}`}><Play size={14} /> Run</button><button onClick={stopBot} disabled={!isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${!isRunning ? 'bg-gray-800 text-gray-500' : 'bg-red-500 text-white'}`}><Square size={14} /> Stop</button><button onClick={resetBot} disabled={isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${isRunning?'bg-gray-900 text-gray-600':'bg-gray-800 border border-gray-700 text-orange-400'}`}><RefreshCw size={14} /> Reset</button></div>
      <div className="bg-black rounded-lg border border-gray-800 overflow-hidden flex-1 min-h-0 flex flex-col"><div className="bg-gray-900 px-2 py-1 flex items-center gap-1 border-b border-gray-800 flex-shrink-0"><Terminal size={10} className="text-green-500" /><span className="text-[10px] text-gray-400 font-bold">AI LOG</span></div><div ref={logRef} onScroll={() => { const el=logRef.current; if(el) shouldAutoScrollRef.current=el.scrollHeight-el.scrollTop-el.clientHeight<60 }} className="flex-1 p-2 overflow-y-auto font-mono text-[10px] space-y-0.5">{logs.map((log, i) => <p key={i} className={log.includes('✅') || log.includes('WON') ? 'text-green-400' : log.includes('❌') || log.includes('LOST') ? 'text-red-500' : log.includes('🤖') || log.includes('🚀') ? 'text-sky-400' : 'text-gray-400'}>{log}</p>)}</div></div>
    </div>
  )
}
