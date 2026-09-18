  return (
    <div className="h-full flex flex-col bg-mwathe-black text-mwathe-white p-2 overflow-hidden">
      <div className="flex items-center gap-2 pb-1 border-b border-gray-800 mb-2 flex-shrink-0">
        <div className="w-7 h-7 bg-gradient-to-br from-mwathe-orange to-mwathe-green rounded-lg flex items-center justify-center">
          <Activity size={16} className="text-white" />
        </div>
        <div>
          <h2 className="text-base font-bold">Denny Bots</h2>
          <p className="text-[10px] text-mwathe-gray flex items-center gap-1"><ShieldCheck size={10} /> Zero Consecutive Loss Protection</p>
        </div>
      </div>

      {validationError && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-2 mb-2 flex items-center gap-2 flex-shrink-0">
          <AlertCircle size={12} className="text-red-500" />
          <p className="text-red-400 text-[10px] font-medium">{validationError}</p>
        </div>
      )}

      <div className="bg-mwathe-darkgray rounded-lg p-2 border border-gray-800 mb-2 flex-shrink-0 overflow-y-auto" style={{maxHeight: '28vh'}}>
        <h3 className="text-mwathe-white font-bold text-xs flex items-center gap-1 mb-2"><Target size={12} className="text-mwathe-orange" /> Parameters</h3>
        
        <div className="mb-2">
          <label className="text-[10px] text-mwathe-gray uppercase font-bold">Select Market</label>
          <select value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5">
            {VOLATILITY_INDICES.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Trade Type</label>
            <select value={tradeType} onChange={e => setTradeType(e.target.value)} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5">
              {TRADE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          {SUB_TRADE_TYPES[tradeType]?.length > 0 && (
            <div>
              <label className="text-[10px] text-mwathe-gray uppercase font-bold">Sub Type</label>
              <select value={subTradeType} onChange={e => setSubTradeType(e.target.value)} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5">
                {SUB_TRADE_TYPES[tradeType].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          )}
        </div>

        {subTradeType && OPTIONS[subTradeType] && (
          <div className="mb-2">
            <label className="text-[10px] text-mwathe-gray uppercase font-bold mb-1 block">Option</label>
            <div className="grid grid-cols-3 gap-1">
              {OPTIONS[subTradeType].map(opt => (
                <button key={opt} onClick={() => setOption(opt)} disabled={isRunning} className={`py-1.5 rounded text-xs font-bold border ${option === opt ? 'bg-mwathe-green/20 border-mwathe-green text-mwathe-green' : 'bg-mwathe-black border-gray-700 text-mwathe-gray'}`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {tradeType === 'Digits' && subTradeType === 'Over/Under' && (
          <div className="mb-2">
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Predicted Digit (0-9) *</label>
            <input type="number" min="0" max="9" value={predictedDigit} onChange={e => setPredictedDigit(e.target.value)} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5" placeholder="Enter digit 0-9" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Time Frame</label>
            {rules.fixed ? (
              <input type="text" value={rules.label} disabled className="w-full bg-mwathe-black/50 border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5 text-mwathe-gray" />
            ) : (
              <select value={timeframeUnit} onChange={e => { setTimeframeUnit(e.target.value); setDurationValue(rules.min) }} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5">
                {rules.units.map(u => <option key={u}>{u}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Duration {rules.fixed ? '' : `(${rules.min}-${rules.maxMap ? rules.maxMap[timeframeUnit] : rules.max})`}</label>
            <input type="number" value={durationValue} onChange={e => setDurationValue(parseInt(e.target.value) || 0)} disabled={isRunning || rules.fixed} className="w-full bg-mwathe-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Stake ($)</label>
            <input type="number" step="0.01" value={stake} onChange={e => setStake(e.target.value)} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5" />
          </div>
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Martingale Factor</label>
            <input type="number" step="0.1" value={martingaleFactor} onChange={e => setMartingaleFactor(e.target.value)} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Target ($)</label>
            <input type="number" step="0.01" value={targetProfit} onChange={e => setTargetProfit(e.target.value)} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5" />
          </div>
          <div>
            <label className="text-[10px] text-mwathe-gray uppercase font-bold">Stop Loss ($)</label>
            <input type="number" step="0.01" value={stopLoss} onChange={e => setStopLoss(e.target.value)} disabled={isRunning} className="w-full bg-mwathe-black border border-gray-700 rounded px-2 py-1.5 text-xs mt-0.5" />
          </div>
        </div>
      </div>

      <div className="bg-mwathe-darkgray rounded-lg p-2 border border-mwathe-green/30 mb-2 flex-shrink-0">
        <h3 className="text-mwathe-white font-bold text-xs mb-1 flex items-center gap-1">
          <TrendingUp size={12} className="text-mwathe-green" /> Live Performance
        </h3>
        <div className="grid grid-cols-4 gap-1 text-center">
          <div className="bg-mwathe-black/50 rounded p-1">
            <p className="text-[9px] text-mwathe-gray">Net P/L</p>
            <p className={`font-bold text-xs ${currentPL >= 0 ? 'text-mwathe-green' : 'text-red-500'}`}>{currentPL >= 0 ? '+' : ''}{currentPL.toFixed(2)}</p>
          </div>
          <div className="bg-mwathe-black/50 rounded p-1">
            <p className="text-[9px] text-mwathe-gray">Win Rate</p>
            <p className="text-mwathe-skyblue font-bold text-xs">{winRate}%</p>
          </div>
          <div className="bg-mwathe-black/50 rounded p-1">
            <p className="text-[9px] text-mwathe-gray">Trades</p>
            <p className="text-mwathe-white font-bold text-xs">{totalTrades}</p>
          </div>
          <div className="bg-mwathe-black/50 rounded p-1">
            <p className="text-[9px] text-mwathe-gray">Next Stake</p>
            <p className="text-mwathe-orange font-bold text-xs">{currentStake.toFixed(2)}</p>
          </div>
        </div>
        <div className="mt-1 flex items-center justify-center gap-1 bg-mwathe-black/50 rounded p-1">
          <ShieldCheck size={10} className={consecutiveLosses === 0 ? "text-mwathe-green" : "text-mwathe-orange"} />
          <p className="text-[9px] text-mwathe-gray">Zero Consecutive Losses: <span className="font-bold text-mwathe-white">{consecutiveLosses === 0 ? 'SECURE' : `${consecutiveLosses} Loss (${martingaleFactor}x Martingale Active)`}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 flex-shrink-0 mb-2">
        <button onClick={startBot} disabled={isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${isRunning ? 'bg-gray-800 text-gray-500' : 'bg-mwathe-green text-black'}`}>
          <Zap size={14} /> Run
        </button>
        <button onClick={stopBot} disabled={!isRunning} className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs ${!isRunning ? 'bg-gray-800 text-gray-500' : 'bg-red-500 text-white'}`}>
          <Square size={14} /> Stop
        </button>
        <button onClick={resetBot} className="py-2 rounded-lg font-bold flex items-center justify-center gap-1 text-xs bg-mwathe-darkgray border border-gray-700 text-mwathe-orange">
          <RefreshCw size={14} /> Reset
        </button>
      </div>

      <div className="bg-black rounded-lg border border-gray-800 overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="bg-mwathe-darkgray px-2 py-1 flex items-center gap-1 border-b border-gray-800 flex-shrink-0">
          <Terminal size={10} className="text-mwathe-green" />
          <span className="text-[10px] text-mwathe-gray font-bold">DISPLAY PANEL</span>
        </div>
        <div ref={logRef} className="flex-1 p-2 overflow-y-auto font-mono text-[10px] space-y-0.5">
          {logs.map((log, i) => (
            <p key={i} className={
              log.includes('✅') || log.includes('WON') || log.includes('Profit') || log.includes('Target') ? 'text-mwathe-green' :
              log.includes('❌') || log.includes('LOST') || log.includes('Stop') || log.includes('failed') ? 'text-red-500' :
              log.includes('🛡️') || log.includes('Martingale') ? 'text-mwathe-orange' :
              log.includes('') || log.includes('🎯') || log.includes('⚡') || log.includes('') || log.includes('📊') ? 'text-mwathe-skyblue' :
              'text-mwathe-gray'
            }>
              {log}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}
