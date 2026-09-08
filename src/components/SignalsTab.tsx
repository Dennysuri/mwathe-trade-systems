import { RotateCcw } from 'lucide-react';

interface SignalsTabProps {
  signalResults: any[];
  onReset: () => void;
}

export default function SignalsTab({ signalResults, onReset }: SignalsTabProps) {
  return (
    <div className="flex flex-col gap-3 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <span className="font-extrabold text-xs text-[#00B0FF] uppercase tracking-wider">Generated Signals Feed</span>
        <button onClick={onReset} className="text-xs text-slate-400 flex items-center gap-1 cursor-pointer">
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      {signalResults.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-[#12161F] border border-slate-800 rounded-2xl">
          No signals logged. Run a scan from the Analysis Tool.
        </div>
      ) : (
        signalResults.map((sig, i) => (
          <div key={i} className="bg-[#12161F] p-4 rounded-2xl border border-slate-800 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="font-extrabold text-xs text-[#00E676]">{sig.asset}</span>
              <span className="bg-[#00E676]/20 text-[#00E676] px-2 py-0.5 text-[9px] font-black rounded">{sig.accuracy} Accuracy</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-300">
              <div><span className="text-slate-500 text-[9px]">Type:</span> {sig.tradeType}</div>
              <div><span className="text-slate-500 text-[9px]">Entry:</span> {sig.entryPoint}</div>
              <div><span className="text-slate-500 text-[9px]">Duration:</span> {sig.duration}</div>
              <div><span className="text-slate-500 text-[9px]">Condition:</span> {sig.marketCondition}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
