import React, { useState, useEffect } from 'react';
import {
  Menu, X, Cpu, Bot, ShieldCheck, Settings as SettingsIcon,
  BarChart2, Zap, Lock, Play, Square, ExternalLink
} from 'lucide-react';
import { derivService } from './derivService';
import { tradingEngine, type StrategyResult } from './tradingEngine';

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'analysis' | 'signals' | 'denny' | 'automated' | 'autod' | 'settings'>('analysis');
  const [isConnected, setIsConnected] = useState(false);
  const [balance, setBalance] = useState(0);

  // AutoD AI Password State
  const [autodUnlocked, setAutodUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // Analysis & Strategy Parameters
  const [selectedSymbol, setSelectedSymbol] = useState('R_100');
  const [selectedTradeType, setSelectedTradeType] = useState('Digits');
  const [selectedSubType, setSelectedSubType] = useState('Over/Under');
  const [selectedOption, setSelectedOption] = useState('Over 2');
  const [analysisResult, setAnalysisResult] = useState<StrategyResult | null>(null);

  // Bot & AutoD Execution State
  const [stake] = useState(10);
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [botLogs, setBotLogs] = useState<string[]>([]);

  useEffect(() => {
    // Handle Deriv OAuth Redirect Token
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token1');
    if (token) {
      derivService.connect(token);
    }

    const subConn = derivService.isConnected$.subscribe(setIsConnected);
    const subBal = derivService.balance$.subscribe(setBalance);
    const subTick = derivService.ticks$.subscribe(tick => {
      if (tick) {
        tradingEngine.addTick(tick.digit);
      }
    });

    return () => {
      subConn.unsubscribe();
      subBal.unsubscribe();
      subTick.unsubscribe();
    };
  }, []);

  const handleConnectDeriv = () => {
    window.location.href = derivService.getAuthUrl();
  };

  const handleUnlockAutoD = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'Denny@1249') {
      setAutodUnlocked(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  const runAnalysis = () => {
    derivService.subscribeTicks(selectedSymbol);
    const result = tradingEngine.analyzeMarket(selectedSymbol, selectedTradeType, selectedSubType, selectedOption);
    setAnalysisResult(result);
  };

  const toggleBot = () => {
    if (isBotRunning) {
      setIsBotRunning(false);
      setBotLogs(prev => [`[SYSTEM] Trading Engine Halted at ${new Date().toLocaleTimeString()}`, ...prev]);
    } else {
      setIsBotRunning(true);
      setBotLogs(prev => [
        `[SYSTEM] Iron Recovery Engine Initialized (Stake: $${stake})`,
        `[STRATEGY] Active Multi-Index Scanning on ${selectedSymbol}...`,
        ...prev
      ]);
    }
  };

  const clearLogs = () => {
    setBotLogs([]);
  };

  return (
    <div className="flex flex-col h-dvh bg-brand-dark text-slate-100 overflow-hidden select-none">
      {/* Top Fixed Header */}
      <header className="h-14 bg-brand-onyx border-b border-brand-border flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="p-2 text-slate-300 hover:text-brand-orange hover:bg-brand-card rounded-lg transition-colors"
          >
            {drawerOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div className="flex items-center gap-2">
            <span className="font-extrabold text-lg tracking-wider bg-gradient-to-r from-brand-orange via-brand-green to-brand-blue bg-clip-text text-transparent">
              MWATHE TRADE SYSTEMS
            </span>
          </div>
        </div>

        {/* Balance & Status Bar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-brand-card px-3 py-1.5 rounded-full border border-brand-border">
            <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-brand-green shadow-[0_0_8px_#00E676]' : 'bg-red-500'}`} />
            <span className="text-xs font-semibold text-slate-400">
              {isConnected ? 'Connected' : 'Offline'}
            </span>
          </div>

          <div className="bg-brand-card border border-brand-border px-3 py-1.5 rounded-lg text-right">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Balance</div>
            <div className="text-sm font-bold text-brand-green">${balance.toFixed(2)}</div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Navigation Drawer Menu */}
        <aside className={`absolute top-0 left-0 h-full w-64 bg-brand-onyx/95 backdrop-blur-md border-r border-brand-border z-30 transition-transform duration-300 ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-4 flex flex-col gap-2">
            <div className="text-xs font-semibold text-slate-500 uppercase px-3 py-2">Trading Suites</div>

            <button
              onClick={() => { setActiveTab('analysis'); setDrawerOpen(false); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${activeTab === 'analysis' ? 'bg-brand-blue/10 text-brand-blue border-l-4 border-brand-blue' : 'text-slate-400 hover:bg-brand-card'}`}
            >
              <BarChart2 size={18} /> Analysis Tool
            </button>

            <button
              onClick={() => { setActiveTab('signals'); setDrawerOpen(false); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${activeTab === 'signals' ? 'bg-brand-blue/10 text-brand-blue border-l-4 border-brand-blue' : 'text-slate-400 hover:bg-brand-card'}`}
            >
              <Zap size={18} /> Live Signals
            </button>

            <button
              onClick={() => { setActiveTab('denny'); setDrawerOpen(false); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${activeTab === 'denny' ? 'bg-brand-green/10 text-brand-green border-l-4 border-brand-green' : 'text-slate-400 hover:bg-brand-card'}`}
            >
              <Bot size={18} /> Denny Bots
            </button>

            <button
              onClick={() => { setActiveTab('automated'); setDrawerOpen(false); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${activeTab === 'automated' ? 'bg-brand-green/10 text-brand-green border-l-4 border-brand-green' : 'text-slate-400 hover:bg-brand-card'}`}
            >
              <Cpu size={18} /> Automated Trading Bot
            </button>

            <button
              onClick={() => { setActiveTab('autod'); setDrawerOpen(false); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${activeTab === 'autod' ? 'bg-brand-orange/10 text-brand-orange border-l-4 border-brand-orange' : 'text-slate-400 hover:bg-brand-card'}`}
            >
              <ShieldCheck size={18} /> AutoD AI (Iron Recovery)
            </button>

            <div className="border-t border-brand-border my-2" />

            <button
              onClick={() => { setActiveTab('settings'); setDrawerOpen(false); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${activeTab === 'settings' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:bg-brand-card'}`}
            >
              <SettingsIcon size={18} /> Settings & OAuth
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-4 overflow-y-auto bg-brand-dark">
          {/* OAuth Connect Banner if Offline */}
          {!isConnected && (
            <div className="mb-4 p-4 bg-brand-card border border-brand-border rounded-xl flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-200">Deriv OAuth Session Required</div>
                <div className="text-xs text-slate-400">Authorize your account to execute live trades & streaming indicators.</div>
              </div>
              <button
                onClick={handleConnectDeriv}
                className="px-4 py-2 bg-gradient-to-r from-brand-orange to-brand-green text-black font-bold text-xs rounded-lg flex items-center gap-2 hover:opacity-90"
              >
                Connect with Deriv <ExternalLink size={14} />
              </button>
            </div>
          )}

          {/* TAB 1: Analysis Tool */}
          {activeTab === 'analysis' && (
            <div className="flex flex-col gap-4">
              <div className="bg-brand-card p-4 rounded-xl border border-brand-border">
                <div className="font-bold text-base mb-3 text-brand-blue flex items-center gap-2">
                  <BarChart2 size={18} /> Market & Indicator Parameters
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Market Index</label>
                    <select
                      value={selectedSymbol}
                      onChange={(e) => setSelectedSymbol(e.target.value)}
                      className="w-full mt-1 bg-brand-dark border border-brand-border text-slate-200 rounded-lg p-2 text-xs"
                    >
                      <option value="R_100">Volatility 100 Index</option>
                      <option value="1HZ100V">Volatility 100 (1s) Index</option>
                      <option value="R_75">Volatility 75 Index</option>
                      <option value="R_50">Volatility 50 Index</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400">Trade Type</label>
                    <select
                      value={selectedTradeType}
                      onChange={(e) => setSelectedTradeType(e.target.value)}
                      className="w-full mt-1 bg-brand-dark border border-brand-border text-slate-200 rounded-lg p-2 text-xs"
                    >
                      <option value="Digits">Digits</option>
                      <option value="Rise/Fall">Rise / Fall</option>
                      <option value="High/Low">High / Low</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400">Sub Type</label>
                    <select
                      value={selectedSubType}
                      onChange={(e) => setSelectedSubType(e.target.value)}
                      className="w-full mt-1 bg-brand-dark border border-brand-border text-slate-200 rounded-lg p-2 text-xs"
                    >
                      <option value="Over/Under">Over / Under</option>
                      <option value="Matches/Differs">Matches / Differs</option>
                      <option value="Even/Odd">Even / Odd</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400">Option</label>
                    <select
                      value={selectedOption}
                      onChange={(e) => setSelectedOption(e.target.value)}
                      className="w-full mt-1 bg-brand-dark border border-brand-border text-slate-200 rounded-lg p-2 text-xs"
                    >
                      <option value="Over 2">Over 2</option>
                      <option value="Under 8">Under 8</option>
                      <option value="Over 1">Over 1</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={runAnalysis}
                  className="mt-4 w-full py-2.5 bg-brand-blue text-brand-onyx font-bold text-xs rounded-lg flex items-center justify-center gap-2 hover:brightness-110"
                >
                  <Zap size={16} /> Start Multi-Indicator Scan
                </button>
              </div>

              {/* Analysis Result Output */}
              {analysisResult && (
                <div className="bg-brand-card p-4 rounded-xl border border-brand-border">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-slate-400 uppercase tracking-wider">Scan Results</span>
                    <span className="px-2 py-0.5 bg-brand-green/20 text-brand-green font-bold text-xs rounded">
                      Accuracy: {analysisResult.accuracy}%
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-brand-dark p-2 rounded-lg border border-brand-border">
                      <div className="text-[10px] text-slate-400">Recommendation</div>
                      <div className="text-sm font-extrabold text-brand-green">{analysisResult.recommendation}</div>
                    </div>
                    <div className="bg-brand-dark p-2 rounded-lg border border-brand-border">
                      <div className="text-[10px] text-slate-400">Predicted Entry</div>
                      <div className="text-sm font-bold text-brand-orange">{analysisResult.entryPoint}</div>
                    </div>
                    <div className="bg-brand-dark p-2 rounded-lg border border-brand-border">
                      <div className="text-[10px] text-slate-400">Target Digit</div>
                      <div className="text-sm font-bold text-brand-blue">{analysisResult.predictedDigit}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: AutoD AI Password Protection & Dashboard */}
          {activeTab === 'autod' && (
            <div>
              {!autodUnlocked ? (
                <div className="max-w-md mx-auto my-12 bg-brand-card p-6 rounded-2xl border border-brand-border text-center">
                  <div className="w-12 h-12 bg-brand-orange/10 border border-brand-orange text-brand-orange rounded-full flex items-center justify-center mx-auto mb-4">
                    <Lock size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-100 mb-1">AutoD AI Security Core</h3>
                  <p className="text-xs text-slate-400 mb-4">Enter developer access credentials to unlock the Iron Recovery Engine.</p>

                  <form onSubmit={handleUnlockAutoD} className="flex flex-col gap-3">
                    <input
                      type="password"
                      placeholder="Enter Security Password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="bg-brand-dark border border-brand-border text-center text-slate-100 rounded-lg p-2.5 text-sm focus:border-brand-orange outline-none"
                    />
                    {passwordError && <span className="text-xs text-red-400 font-medium">Invalid developer password.</span>}
                    <button
                      type="submit"
                      className="py-2.5 bg-brand-orange text-brand-onyx font-bold text-xs rounded-lg hover:brightness-110"
                    >
                      Authenticate Access
                    </button>
                  </form>
                </div>
              ) : (
                <div className="bg-brand-card p-4 rounded-xl border border-brand-border">
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-bold text-brand-orange flex items-center gap-2">
                      <ShieldCheck size={18} /> Iron Recovery Engine Dashboard
                    </div>
                    <button onClick={clearLogs} className="text-xs text-slate-400 hover:text-slate-200">
                      Clear Logs
                    </button>
                  </div>

                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={toggleBot}
                      className={`flex-1 py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 ${
                        isBotRunning ? 'bg-red-500 text-white' : 'bg-brand-green text-black'
                      }`}
                    >
                      {isBotRunning ? <Square size={16} /> : <Play size={16} />}
                      {isBotRunning ? 'Halt Bot' : 'Run AutoD Bot'}
                    </button>
                  </div>

                  <div className="bg-brand-dark p-3 rounded-lg border border-brand-border h-48 overflow-y-auto font-mono text-xs text-slate-300 flex flex-col gap-1">
                    {botLogs.length === 0 ? (
                      <span className="text-slate-500 italic">No activity logged. Click 'Run AutoD Bot' to start scanning.</span>
                    ) : (
                      botLogs.map((log, i) => <div key={i}>{log}</div>)
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
