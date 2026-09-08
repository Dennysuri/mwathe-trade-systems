import React, { useState, useEffect } from 'react';
import {
  Menu, X, Cpu, Bot, ShieldCheck, Settings as SettingsIcon,
  BarChart2, Zap, Lock, Play, Square, ExternalLink, Home
} from 'lucide-react';
import { derivService } from './derivService';
import { tradingEngine, type StrategyResult } from './tradingEngine';

type PageView = 'dashboard' | 'analysis' | 'signals' | 'denny' | 'automated' | 'autod' | 'settings';

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<PageView>('dashboard');
  const [isConnected, setIsConnected] = useState(false);
  const [balance, setBalance] = useState(0);
  const [customAppId, setCustomAppId] = useState('1089');

  const [autodUnlocked, setAutodUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const [selectedSymbol, setSelectedSymbol] = useState('R_100');
  const [selectedTradeType, setSelectedTradeType] = useState('Digits');
  const [selectedSubType, setSelectedSubType] = useState('Over/Under');
  const [selectedOption, setSelectedOption] = useState('Over 2');
  const [analysisResult, setAnalysisResult] = useState<StrategyResult | null>(null);

  const [stake, setStake] = useState(10);
  const [martingaleFactor, setMartingaleFactor] = useState(2.1);
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [botLogs, setBotLogs] = useState<string[]>([]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token1');
    if (token) derivService.connect(token);

    const subConn = derivService.isConnected$.subscribe(setIsConnected);
    const subBal = derivService.balance$.subscribe(setBalance);
    const subTick = derivService.ticks$.subscribe(tick => {
      if (tick) tradingEngine.addTick(tick.digit);
    });

    return () => {
      subConn.unsubscribe();
      subBal.unsubscribe();
      subTick.unsubscribe();
    };
  }, []);

  const handleConnectDeriv = () => {
    derivService.setAppId(customAppId);
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
    setAnalysisResult(tradingEngine.analyzeMarket(selectedSymbol, selectedTradeType, selectedSubType, selectedOption));
  };

  const toggleBot = (botName: string) => {
    setIsBotRunning(!isBotRunning);
    setBotLogs(prev => [`[SYSTEM] ${botName} state updated at ${new Date().toLocaleTimeString()}`, ...prev]);
  };

  const navigateTo = (page: PageView) => {
    setCurrentPage(page);
    setDrawerOpen(false);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-brand-dark text-slate-100 overflow-hidden select-none">
      <header className="h-14 bg-brand-onyx border-b border-brand-border flex items-center justify-between px-4 z-30 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setDrawerOpen(!drawerOpen)} className="p-2 text-slate-300 hover:text-brand-orange hover:bg-brand-card rounded-lg">
            {drawerOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <span className="font-extrabold text-sm md:text-lg tracking-wider bg-gradient-to-r from-brand-orange via-brand-green to-brand-blue bg-clip-text text-transparent">
            MWATHE TRADE SYSTEMS
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-brand-card px-3 py-1.5 rounded-full border border-brand-border">
            <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-brand-green' : 'bg-red-500'}`} />
            <span className="text-xs text-slate-400">{isConnected ? 'Connected' : 'Offline'}</span>
          </div>
          <div className="bg-brand-card border border-brand-border px-3 py-1.5 rounded-lg text-right">
            <div className="text-[10px] text-slate-400">BALANCE</div>
            <div className="text-sm font-bold text-brand-green">${balance.toFixed(2)}</div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {drawerOpen && <div className="absolute inset-0 bg-black/60 z-30" onClick={() => setDrawerOpen(false)} />}

        <aside className={`absolute top-0 left-0 h-full w-64 bg-brand-onyx border-r border-brand-border z-40 transition-transform duration-300 ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-4 flex flex-col gap-2">
            <button onClick={() => navigateTo('dashboard')} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm ${currentPage === 'dashboard' ? 'bg-brand-orange/10 text-brand-orange' : 'text-slate-400'}`}>
              <Home size={18} /> Central Dashboard
            </button>
            <button onClick={() => navigateTo('analysis')} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm ${currentPage === 'analysis' ? 'bg-brand-blue/10 text-brand-blue' : 'text-slate-400'}`}>
              <BarChart2 size={18} /> Analysis Tool
            </button>
            <button onClick={() => navigateTo('denny')} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm ${currentPage === 'denny' ? 'bg-brand-green/10 text-brand-green' : 'text-slate-400'}`}>
              <Bot size={18} /> Denny Bots
            </button>
            <button onClick={() => navigateTo('autod')} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm ${currentPage === 'autod' ? 'bg-brand-orange/10 text-brand-orange' : 'text-slate-400'}`}>
              <ShieldCheck size={18} /> AutoD AI Suite
            </button>
            <button onClick={() => navigateTo('settings')} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm ${currentPage === 'settings' ? 'bg-slate-800 text-slate-100' : 'text-slate-400'}`}>
              <SettingsIcon size={18} /> Settings & API
            </button>
          </div>
        </aside>

        <main className="flex-1 p-4 overflow-y-auto bg-brand-dark">
          {currentPage === 'dashboard' && (
            <div className="bg-brand-card p-5 rounded-2xl border border-brand-border">
              <h1 className="text-xl font-extrabold text-slate-100 mb-1">Execution Hub Dashboard</h1>
              <p className="text-xs text-slate-400">Select a trading page from navigation menu.</p>
            </div>
          )}

          {currentPage === 'analysis' && (
            <div className="bg-brand-card p-4 rounded-xl border border-brand-border">
              <div className="font-bold text-base mb-3 text-brand-blue flex items-center gap-2"><BarChart2 size={18} /> Analysis Page</div>
              <button onClick={runAnalysis} className="w-full py-2.5 bg-brand-blue text-brand-onyx font-bold text-xs rounded-lg">Execute Market Scan</button>
            </div>
          )}

          {currentPage === 'denny' && (
            <div className="bg-brand-card p-4 rounded-xl border border-brand-border">
              <div className="font-bold text-base mb-2 text-brand-green flex items-center gap-2"><Bot size={18} /> Denny Bots Page</div>
              <button onClick={() => toggleBot('Denny Bot')} className="w-full py-2.5 bg-brand-green text-black font-bold text-xs rounded-lg">{isBotRunning ? 'Stop' : 'Start'} Denny Bot</button>
            </div>
          )}

          {currentPage === 'autod' && (
            <div className="bg-brand-card p-4 rounded-xl border border-brand-border">
              {!autodUnlocked ? (
                <form onSubmit={handleUnlockAutoD} className="flex flex-col gap-3 max-w-xs mx-auto">
                  <input type="password" placeholder="Enter Password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="bg-brand-dark border border-brand-border text-center p-2 text-xs rounded" />
                  <button type="submit" className="py-2 bg-brand-orange text-black font-bold text-xs rounded">Authenticate</button>
                </form>
              ) : (
                <div><div className="font-bold text-brand-orange mb-2"><ShieldCheck size={18} /> AutoD AI Iron Recovery Page</div><button onClick={() => toggleBot('AutoD AI')} className="w-full py-2 bg-brand-orange text-black font-bold text-xs rounded">Run Iron Recovery Bot</button></div>
              )}
            </div>
          )}

          {currentPage === 'settings' && (
            <div className="bg-brand-card p-4 rounded-xl border border-brand-border">
              <button onClick={handleConnectDeriv} className="py-2.5 px-4 bg-brand-green text-black font-bold text-xs rounded-lg">Connect Deriv OAuth</button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
