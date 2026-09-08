import { useState, useEffect } from 'react';
import { Menu, X, ShieldCheck, Settings as SettingsIcon, BarChart2, Zap, Moon, Sun } from 'lucide-react';
import { derivService } from '../derivService';
import AnalysisTab from '../components/AnalysisTab';
import SignalsTab from '../components/SignalsTab';

type MenuSection = 'analysis' | 'signals' | 'denny' | 'automated' | 'autod' | 'settings';

interface TradingPageProps {
  onReconnect: () => void;
}

export default function TradingPage({ onReconnect }: TradingPageProps) {
  const [activeMenuSection, setActiveMenuSection] = useState<MenuSection>('analysis');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [balance, setBalance] = useState(0.00);

  const [darkMode, setDarkMode] = useState(true);

  // Parameters
  const [tradeType, setTradeType] = useState('Digits');
  const [subTradeType, setSubTradeType] = useState('Over/Under');
  const [selectedOption, setSelectedOption] = useState('Both');
  const [predictedDigit, setPredictedDigit] = useState('5');
  const [analysisDuration] = useState('10');
  const [digitHistoryLength, setDigitHistoryLength] = useState('50');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [signalResults, setSignalResults] = useState<any[]>([]);

  useEffect(() => {
    switch (tradeType) {
      case 'Accumulators': setSubTradeType('N/A'); setSelectedOption('N/A'); break;
      case 'Vanillas': setSubTradeType('Call/Put'); setSelectedOption('Both'); break;
      case 'Turbos': setSubTradeType('Turbos'); setSelectedOption('Both'); break;
      case 'Multipliers': setSubTradeType('Multipliers'); setSelectedOption('Both'); break;
      case 'Ups & Downs': setSubTradeType('Rise/Fall'); setSelectedOption('Both'); break;
      case 'Touch & No Touch': setSubTradeType('Touch/No Touch'); setSelectedOption('Both'); break;
      default: setSubTradeType('Over/Under'); setSelectedOption('Both'); break;
    }
  }, [tradeType]);

  useEffect(() => {
    const connSub = derivService.isConnected$.subscribe(setIsConnected);
    const balSub = derivService.balance$.subscribe(setBalance);
    return () => { connSub.unsubscribe(); balSub.unsubscribe(); };
  }, []);

  const startAnalysis = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setSignalResults(prev => [{
        asset: 'Volatility 100 Index', tradeType, subType: subTradeType,
        option: selectedOption, entryPoint: tradeType === 'Digits' ? `Digit ${predictedDigit}` : 'Dynamic Cross',
        duration: `${analysisDuration}s`, accuracy: '88.5%', marketCondition: 'High Volatility Trend'
      }, ...prev]);
      setIsAnalyzing(false);
    }, 1000);
  };

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden select-none ${darkMode ? 'bg-[#0B0E14] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <header className="h-14 bg-[#12161F] border-b border-slate-800 flex items-center justify-between px-4 shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => setDrawerOpen(!drawerOpen)} className="p-2 text-slate-300 hover:text-[#FF6B00] bg-slate-800/50 rounded-lg cursor-pointer">
            {drawerOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="font-extrabold text-xs tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B00] via-[#00E676] to-[#00B0FF]">
            MWATHE TRADE SYSTEMS
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#00E676]' : 'bg-red-500'}`} />
          <span className="text-[9px] font-bold text-slate-400 uppercase">${balance.toFixed(2)}</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {drawerOpen && <div className="absolute inset-0 bg-black/60 z-30" onClick={() => setDrawerOpen(false)} />}
        
        <aside className={`absolute top-0 left-0 h-full w-60 bg-[#12161F] border-r border-slate-800 z-40 transition-transform ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-3 flex flex-col gap-1.5">
            <button onClick={() => { setActiveMenuSection('analysis'); setDrawerOpen(false); }} className="flex items-center gap-3 px-3 py-2 text-xs text-slate-400 font-bold cursor-pointer"><BarChart2 size={16}/> Analysis</button>
            <button onClick={() => { setActiveMenuSection('signals'); setDrawerOpen(false); }} className="flex items-center gap-3 px-3 py-2 text-xs text-slate-400 font-bold cursor-pointer"><Zap size={16}/> Signals</button>
            <button onClick={() => { setActiveMenuSection('autod'); setDrawerOpen(false); }} className="flex items-center gap-3 px-3 py-2 text-xs text-slate-400 font-bold cursor-pointer"><ShieldCheck size={16}/> AutoD AI</button>
            <button onClick={() => { setActiveMenuSection('settings'); setDrawerOpen(false); }} className="flex items-center gap-3 px-3 py-2 text-xs text-slate-400 font-bold cursor-pointer"><SettingsIcon size={16}/> Settings</button>
          </div>
        </aside>

        <main className="flex-1 p-4 overflow-y-auto bg-[#0B0E14]">
          {activeMenuSection === 'analysis' && (
            <AnalysisTab {...{ tradeType, setTradeType, subTradeType, selectedOption, setSelectedOption, predictedDigit, setPredictedDigit, digitHistoryLength, setDigitHistoryLength, isAnalyzing, startAnalysis, stopAnalysis: () => setIsAnalyzing(false) }} />
          )}
          {activeMenuSection === 'signals' && (
            <SignalsTab signalResults={signalResults} onReset={() => setSignalResults([])} />
          )}
          {activeMenuSection === 'settings' && (
            <div className="bg-[#12161F] p-4 rounded-2xl border border-slate-800 max-w-md mx-auto flex flex-col gap-3">
              <div className="text-xs font-bold text-slate-200 uppercase">Preferences</div>
              <button onClick={() => setDarkMode(!darkMode)} className="p-2 bg-slate-800 rounded text-xs flex items-center justify-between cursor-pointer">Theme {darkMode ? <Moon size={14}/> : <Sun size={14}/>}</button>
              <button onClick={onReconnect} className="p-2 bg-[#00E676] text-black font-bold rounded text-xs cursor-pointer">Re-Authorize OAuth</button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
