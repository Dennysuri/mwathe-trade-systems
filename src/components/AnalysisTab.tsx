interface AnalysisTabProps {
  tradeType: string;
  setTradeType: (val: string) => void;
  subTradeType: string;
  selectedOption: string;
  setSelectedOption: (val: string) => void;
  predictedDigit: string;
  setPredictedDigit: (val: string) => void;
  digitHistoryLength: string;
  setDigitHistoryLength: (val: string) => void;
  isAnalyzing: boolean;
  startAnalysis: () => void;
  stopAnalysis: () => void;
}

export default function AnalysisTab({
  tradeType, setTradeType, subTradeType, selectedOption, setSelectedOption,
  predictedDigit, setPredictedDigit, digitHistoryLength, setDigitHistoryLength,
  isAnalyzing, startAnalysis, stopAnalysis
}: AnalysisTabProps) {
  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto">
      <div className="bg-[#12161F] p-3 rounded-2xl border border-slate-800 h-40 flex items-center justify-center text-slate-500 font-mono text-xs">
        [ Real-Time Volatility Index Feed & Chart Display ]
      </div>

      <div className="bg-[#12161F] p-4 rounded-2xl border border-slate-800 flex flex-col gap-3">
        <div className="font-bold text-xs text-[#00B0FF] uppercase tracking-wider">Multi-Indicator Parameter Suite</div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[9px] text-slate-400 uppercase font-bold">Trade Type</label>
            <select value={tradeType} onChange={(e) => setTradeType(e.target.value)} className="w-full mt-1 bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-xs font-medium">
              <option value="Digits">Digits</option>
              <option value="Ups & Downs">Ups & Downs</option>
              <option value="Multipliers">Multipliers</option>
              <option value="Touch & No Touch">Touch & No Touch</option>
              <option value="Accumulators">Accumulators</option>
              <option value="Vanillas">Vanillas</option>
              <option value="Turbos">Turbos</option>
            </select>
          </div>

          <div>
            <label className="text-[9px] text-slate-400 uppercase font-bold">Sub Trade Type</label>
            <input type="text" value={subTradeType} readOnly className="w-full mt-1 bg-slate-900 border border-slate-800 text-slate-400 rounded-lg p-2 text-xs font-medium" />
          </div>

          <div>
            <label className="text-[9px] text-slate-400 uppercase font-bold">Option Filter</label>
            <select value={selectedOption} onChange={(e) => setSelectedOption(e.target.value)} className="w-full mt-1 bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-xs font-medium">
              <option value="Both">Both</option>
              <option value="Over">Over / Call</option>
              <option value="Under">Under / Put</option>
            </select>
          </div>
        </div>

        {tradeType === 'Digits' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] text-slate-400 uppercase font-bold">Predicted Digit</label>
              <input type="number" min="0" max="9" value={predictedDigit} onChange={(e) => setPredictedDigit(e.target.value)} className="w-full mt-1 bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-xs font-medium" />
            </div>
            <div>
              <label className="text-[9px] text-slate-400 uppercase font-bold">Digit History Length</label>
              <input type="number" value={digitHistoryLength} onChange={(e) => setDigitHistoryLength(e.target.value)} className="w-full mt-1 bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-xs font-medium" />
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <button onClick={startAnalysis} disabled={isAnalyzing} className="flex-1 py-3 bg-[#00B0FF] text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer">
            {isAnalyzing ? 'Scanning 100+ Indicators...' : 'Start Analysis Scan'}
          </button>
          <button onClick={stopAnalysis} className="px-4 py-3 bg-red-500/20 text-red-400 font-bold text-xs rounded-xl border border-red-500/30 cursor-pointer">
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}
