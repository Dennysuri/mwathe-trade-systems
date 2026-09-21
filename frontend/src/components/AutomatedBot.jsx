  const calculateConfluence = (symbol, targetDigit) => {
    const ticks = tickDataRef.current[symbol]
    if (!ticks || ticks.length < 30) return { score: 50, signal: 'CALL', reasons: [] }
    
    let score = 50, reasons = [], signal = 'CALL'
    const digits = ticks.map(t => parseInt(t.toString().slice(-1)))
    const td = parseInt(targetDigit)
    
    if (tradeType === 'Digits') {
      if (calcFastMarkov(digits, td) > 0.35) { score += 20; reasons.push('m') }
      if (calcFastEntropy(digits) < 2.5) { score += 20; reasons.push('e') }
      if (calcFastFrequency(digits, td)) { score += 20; reasons.push('f') }
      signal = (option === 'Over' && td < 5) || (option === 'Under' && td > 4) ? 'CALL' : 'PUT'
    } else {
      const hurst = calcHurst(ticks)
      if (hurst > 0.65) { score += 30; reasons.push('h') }
      const rsi = calcRSI(ticks)
      if (rsi < 30 || rsi > 70) { score += 25; reasons.push('r') }
      // FIXED SYNTAX: Use ternary operator for clean inline assignment
      signal = hurst > 0.5 ? 'CALL' : 'PUT'
    }
    return { score: Math.min(score, 99), signal, reasons }
  }

  const scanMarkets = () => {
    let bestSym = null, bestScore = -1, bestSignal = 'CALL', bestReasons = []
    const blacklisted = blacklistedMarketsRef.current
    
    // SCAN ALL 13 MARKETS
    Object.keys(SYMBOL_MAP).forEach(name => {
      const sym = SYMBOL_MAP[name]
      if (blacklisted.includes(sym)) return
      if (tradeType === 'Digits' && !ALLOWED_DIGITS_MARKETS.includes(sym)) return
      
      const res = calculateConfluence(sym, predictedDigit)
      // STRICT: Require 3 strategies to align (Normal & Recovery)
      if (res.reasons.length >= 3 && res.score > bestScore) { 
        bestScore = res.score; bestSym = sym; bestSignal = res.signal; bestReasons = res.reasons 
      }
    })
    
    if (!bestSym) return { symbol: null, score: 0, signal: 'CALL', reasons: [] }
    return { symbol: bestSym, score: bestScore, signal: bestSignal, reasons: bestReasons }
  }

  const runTradeCycle = async () => {
    if (!historyLoadedRef.current) {
      addLog('🔬 Analyzing markets...')
      await loadAllHistory()
    }
    
    let lastLossTime = 0
    
    while (isRunningRef.current) {
      try {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) { await new Promise(r => setTimeout(r, 2000)); continue }
        
        // 15s Cooldown after ANY loss
        if (Date.now() - lastLossTime < 15000) {
          await new Promise(r => setTimeout(r, 2000)); continue
        }
        
        // 30s Hard Cooldown after 2 consecutive losses
        if (consecutiveLossesRef.current >= 2 && !cooldownActiveRef.current) {
          addLog(`🛑 2 CONSECUTIVE LOSSES. 30-SECOND COOLDOWN...`)
          cooldownActiveRef.current = true
          await new Promise(r => setTimeout(r, 30000))
          cooldownActiveRef.current = false
          recoveryLogAddedRef.current = false
          continue
        }

        const best = scanMarkets()
        
        if (!best.symbol) { 
          if (consecutiveLossesRef.current > 0 && !recoveryLogAddedRef.current) {
            addLog(`🔴 RECOVERY MODE: ⏳ [O]`)
            recoveryLogAddedRef.current = true
          }
          await new Promise(r => setTimeout(r, 2000)); continue 
        }
        
        setBestMarket(Object.keys(SYMBOL_MAP).find(key => SYMBOL_MAP[key] === best.symbol) || best.symbol)
        setConfluenceScore(best.score)
        addLog(`🎯 LOCKED: ${best.symbol} | Score: ${best.score}%`)
        addLog(`🚀 EXECUTING...`)
        
        const contractType = getContractType()
        const tradeStake = roundStake(currentStakeRef.current)
        const proposalReq = { proposal: 1, amount: tradeStake, basis: 'stake', contract_type: contractType, currency: 'USD', duration: durationValue, duration_unit: timeframeUnit === 'Minutes' ? 'm' : 't', underlying_symbol: best.symbol }
        if (tradeType === 'Digits' && subTradeType === 'Over/Under' && predictedDigit) proposalReq.barrier = predictedDigit
        
        const proposalRes = await wsRequest(proposalReq)
        if (!isRunningRef.current) break
        const buyRes = await wsRequest({ buy: proposalRes.proposal.id, price: proposalRes.proposal.ask_price })
        if (!isRunningRef.current) break
        
        addLog(`✅ Contract: ${buyRes.buy.contract_id}`)
        const contractResult = await monitorContract(buyRes.buy.contract_id)
        if (!isRunningRef.current || !contractResult) break
        
        const profit = parseFloat(contractResult.profit || 0)
        const isWin = profit > 0
        totalTradesRef.current += 1
        sessionPLRef.current += profit
        
        if (isWin) {
          winsRef.current += 1; consecutiveLossesRef.current = 0; currentStakeRef.current = parseFloat(stake)
          blacklistedMarketsRef.current = []
          recoveryLogAddedRef.current = false
          addLog(`✅ WON +$${profit.toFixed(2)}`)
          addLog(`🟢 NORMAL MODE`)
        } else {
          lossesRef.current += 1; consecutiveLossesRef.current += 1
          lastLossTime = Date.now()
          if (!blacklistedMarketsRef.current.includes(best.symbol)) blacklistedMarketsRef.current.push(best.symbol)
          addLog(`🛡️ Blacklisted ${best.symbol}`)
          const martingale = parseFloat(martingaleFactor) || 1.5
          currentStakeRef.current = roundStake(currentStakeRef.current * martingale)
          addLog(`❌ LOST -$${profit.toFixed(2)} | Next: $${currentStakeRef.current.toFixed(2)}`)
        }
        
        setTotalTrades(totalTradesRef.current); setWins(winsRef.current); setLosses(lossesRef.current); 
        setConsecutiveLosses(consecutiveLossesRef.current); setCurrentStake(currentStakeRef.current); 
        setCurrentPL(sessionPLRef.current)
        
        if (sessionPLRef.current >= parseFloat(targetProfit)) { addLog(`🎯 TARGET HIT! $${sessionPLRef.current.toFixed(2)}`); setIsRunning(false); isRunningRef.current = false; break }
        if (sessionPLRef.current <= -parseFloat(stopLoss)) { addLog(`🛑 STOP LOSS HIT!`); setIsRunning(false); isRunningRef.current = false; break }
        
        addLog(`📊 P/L: $${sessionPLRef.current.toFixed(2)} | Trades: ${totalTradesRef.current}`)
        await new Promise(r => setTimeout(r, 1000))
      } catch (error) {
        if (!isRunningRef.current) break
        addLog(`❌ Error: ${error.message}`)
        await new Promise(r => setTimeout(r, 2000))
      }
    }
  }

  const startBot = () => {
    setValidationError('')
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) { setValidationError('Not connected.'); return }
    isRunningRef.current = true; setIsRunning(true)
    sessionPLRef.current = 0; totalTradesRef.current = 0; winsRef.current = 0; lossesRef.current = 0; consecutiveLossesRef.current = 0
    currentStakeRef.current = parseFloat(stake); blacklistedMarketsRef.current = []; historyLoadedRef.current = false
    recoveryLogAddedRef.current = false; cooldownActiveRef.current = false
    setCurrentPL(0); setTotalTrades(0); setWins(0); setLosses(0); setConsecutiveLosses(0); setCurrentStake(parseFloat(stake)); setConfluenceScore(0); setLogs([])
    addLog(`⚡ AUTOMATED BOT ACTIVATED`)
    addLog(`Type: ${tradeType} | Stake: $${stake} | Martingale: ${martingaleFactor}x`)
    addLog(`Target: $${targetProfit} | Stop: $${stopLoss}`)
    runTradeCycle()
  }

  const stopBot = () => { isRunningRef.current = false; setIsRunning(false); if (wsRef.current) wsRef.current.send(JSON.stringify({ forget: 'all', req_id: reqIdRef.current++ })); addLog(`⏹️ Stopped`) }
  const resetBot = () => { stopBot(); setLogs(['System reset.']); setCurrentPL(0); setTotalTrades(0); setWins(0); setLosses(0); setConsecutiveLosses(0); setCurrentStake(parseFloat(stake)); setValidationError(''); setConfluenceScore(0); setBestMarket('Scanning...'); sessionPLRef.current = 0; totalTradesRef.current = 0; winsRef.current = 0; lossesRef.current = 0; consecutiveLossesRef.current = 0; currentStakeRef.current = parseFloat(stake); blacklistedMarketsRef.current = []; historyLoadedRef.current = false; recoveryLogAddedRef.current = false; cooldownActiveRef.current = false }
  const rules = TIMEFRAME_RULES[tradeType]
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0'
  return (
    <div className="h-full flex flex-col bg-gray-950 text-white p-2 overflow-hidden">
      <div className="flex items-center gap-2 pb-1 border-b border-gray-800 mb-2 flex-shrink-0"><div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-green-500 rounded-lg flex items-center justify-center"><Zap size={16} className="text-white" /></div><div><h2 className="text-base font-bold text-white">Automated Bot</h2><p className="text-[10px] text-gray-400 flex items-center gap-1"><ShieldCheck size={10} /> Auto-Selects Best Market</p></div></div>
      {validationError && <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-2 mb-2 flex items-center gap-2 flex-shrink-0"><AlertCircle size={12} className="text-red-500" /><p className="text-red-400 text-[10px] font-medium">{validationError}</p></div>}
      <div className="bg-gray-900 rounded-lg p-2 border border-gray-800 mb-2 flex-shrink-0 overflow-y-auto" style={{maxHeight: '28vh'}}>
        <h3 className="text-white font-bold text-xs flex items-center gap-1 mb-2"><Target size={12} className="text-orange-500" /> Parameters</h3>
        <div className="grid grid-cols-2 gap-2 mb-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Type</label><select value={tradeType} onChange={e => setTradeType(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{TRADE_TYPES.map(t => <option key={t} className="text-white">{t}</option>)}</select></div>{SUB_TRADE_TYPES[tradeType]?.length > 0 && <div><label className="text-[10px] text-gray-400 uppercase font-bold">Sub Type</label><select value={subTradeType} onChange={e => setSubTradeType(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{SUB_TRADE_TYPES[tradeType].map(t => <option key={t} className="text-white">{t}</option>)}</select></div>}</div>
        {subTradeType && OPTIONS[subTradeType] && <div className="mb-2"><label className="text-[10px] text-gray-400 uppercase font-bold mb-1 block">Option</label><div className="grid grid-cols-3 gap-1">{OPTIONS[subTradeType].map(opt => <button key={opt} onClick={() => setOption(opt)} disabled={isRunning} className={`py-1.5 rounded text-xs font-bold border ${option === opt ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-black border-gray-700 text-gray-400'}`}>{opt}</button>)}</div></div>}
        {tradeType === 'Digits' && subTradeType === 'Over/Under' && <div className="mb-2"><label className="text-[10px] text-gray-400 uppercase font-bold">Digit (0-9)</label><input type="number" min="0" max="9" value={predictedDigit} onChange={e => setPredictedDigit(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div>}
        <div className="grid grid-cols-2 gap-2 mb-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Time</label>{rules.fixed ? <input type="text" value={rules.label} disabled className="w-full bg-black/50 border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-gray-500" /> : <select value={timeframeUnit} onChange={e => { setTimeframeUnit(e.target.value); setDurationValue(rules.min) }} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white">{rules.units.map(u => <option key={u} className="text-white">{u}</option>)}</select>}</div><div><label className="text-[10px] text-gray-400 uppercase font-bold">Duration</label><input type="number" value={durationValue} onChange={e => setDurationValue(parseInt(e.target.value) || 0)} disabled={isRunning || rules.fixed} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div></div>
        <div className="grid grid-cols-2 gap-2 mb-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Stake</label><input type="number" step="0.01" value={stake} onChange={e => setStake(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div><div><label className="text-[10px] text-gray-400 uppercase font-bold">Martingale</label><input type="number" step="0.1" value={martingaleFactor} onChange={e => setMartingaleFactor(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div></div>
        <div className="grid grid-cols-2 gap-2"><div><label className="text-[10px] text-gray-400 uppercase font-bold">Target</label><input type="number" step="0.01" value={targetProfit} onChange={e => setTargetProfit(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div><div><label className="text-[10px] text-gray-400 uppercase font-bold">Stop Loss</label><input type="number" step="0.01" value={stopLoss} onChange={e => setStopLoss(e.target.value)} disabled={isRunning} className="w-full bg-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-white" /></div></div>
      </div>
      <div className="bg-gray-900 rounded-lg p-2 border border-green-500/30 mb-2 flex-shrink-0">
        <h3 className="text-white font-bold text-xs mb-1 flex items-center gap-1"><TrendingUp size={12} className="text-green-500" /> Performance & Target</h3>
        <div className="mb-1 flex justify-between items-center bg-black/50 rounded p-1"><span className="text-[9px] text-gray-400">Best Market:</span><span className="text-[10px] text-orange-400 font-bold">{bestMarket}</span></div>
        <div className="mb-1 flex justify-between items-center bg-black/50 rounded p-1"><span className="text-[9px] text-gray-400">Confluence Score:</span><span className={`text-[10px] font-bold ${confluenceScore >= 80 ? 'text-green-400' : 'text-orange-400'}`}>{confluenceScore.toFixed(0)}%</span></div>
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
      <div className="grid grid-cols-3 gap-2 flex-shrink-0 mb-2"><button onClick={startBot} disabled={isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${isRunning ? 'bg-gray-800 text-gray-500' : 'bg-green-500 text-black'}`}><Play size={14} /> Run</button><button onClick={stopBot} disabled={!isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${!isRunning ? 'bg-gray-800 text-gray-500' : 'bg-red-500 text-white'}`}><Square size={14} /> Stop</button><button onClick={resetBot} className="py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs bg-gray-800 border border-gray-700 text-orange-400"><RefreshCw size={14} /> Reset</button></div>
      <div className="bg-black rounded-lg border border-gray-800 overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="bg-gray-900 px-2 py-1 flex items-center gap-1 border-b border-gray-800 flex-shrink-0"><Terminal size={10} className="text-green-500" /><span className="text-[10px] text-gray-400 font-bold">EXECUTION LOG</span></div>
        <div ref={logRef} className="flex-1 p-2 overflow-y-auto font-mono text-[10px] space-y-0.5" style={{scrollBehavior: 'auto'}}>
          {logs.map((log, i) => <p key={i} className={log.includes('✅') || log.includes('WON') || log.includes('TARGET') || log.includes('NORMAL') ? 'text-green-400' : log.includes('❌') || log.includes('LOST') || log.includes('Error') || log.includes('RECOVERY') || log.includes('COOLDOWN') ? 'text-red-500' : log.includes('🚀') || log.includes('🎯') || log.includes('') || log.includes('🛡️') || log.includes('⏳') ? 'text-sky-400' : log.includes('️') || log.includes('⚠️') || log.includes('LOCKDOWN') ? 'text-orange-400' : log.includes('━━') ? 'text-gray-600' : 'text-gray-400'}>{log}</p>)}
        </div>
      </div>
    </div>
  )
}
