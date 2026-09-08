interface DashboardPageProps {
  onGetStarted: () => void;
}

export default function DashboardPage({ onGetStarted }: DashboardPageProps) {
  return (
    <div className="flex flex-col justify-between items-center h-full w-full p-6 text-center max-w-lg mx-auto bg-[#0B0E14] text-slate-100 select-none">
      <div className="my-auto flex flex-col items-center">
        <div className="text-4xl md:text-5xl font-black tracking-tight leading-none mb-4 bg-gradient-to-r from-[#FF6B00] via-[#00E676] to-[#00B0FF] bg-clip-text text-transparent">
          MWATHE TRADE SYSTEMS
        </div>
        <div className="w-20 h-1 bg-gradient-to-r from-[#FF6B00] via-[#00E676] to-[#00B0FF] rounded-full mb-6" />
        <p className="text-xs md:text-sm text-slate-400 font-medium leading-relaxed max-w-sm">
          High-frequency automated execution suite powered by multi-indicator algorithmic analysis and secure Deriv OAuth integration.
        </p>
      </div>

      <button
        onClick={onGetStarted}
        className="w-full py-4 bg-gradient-to-r from-[#FF6B00] to-[#00E676] text-black font-black text-sm rounded-2xl shadow-lg hover:brightness-110 transition-all uppercase tracking-wider mb-6 cursor-pointer"
      >
        Get Started
      </button>
    </div>
  );
}
