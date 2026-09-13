import { ExternalLink } from 'lucide-react';
import { derivService } from '../derivService';

interface NavigationPageProps {
  onBack: () => void;
}

export default function NavigationPage({ onBack }: NavigationPageProps) {
  const handleConnectDeriv = () => {
    window.location.href = derivService.getAuthUrl();
  };

  return (
    <div className="flex flex-col justify-between items-center h-full w-full p-6 text-center max-w-sm mx-auto bg-[#0B0E14] text-slate-100 select-none">
      <div className="my-auto flex flex-col items-center w-full">
        <div className="text-xl font-black tracking-wider text-[#FF6B00] mb-2">
          DERIV OAUTH ACCESS
        </div>
        <p className="text-xs text-slate-400 mb-6">
          Secure, tokenless connection via official Deriv OAuth 2.0 authorization endpoints.
        </p>

        <button
          onClick={handleConnectDeriv}
          className="w-full py-4 bg-[#00E676] text-black font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md hover:bg-[#00c853] transition-colors cursor-pointer"
        >
          Connect with Deriv <ExternalLink size={16} />
        </button>
      </div>

      <button
        onClick={onBack}
        className="text-xs text-slate-500 underline mb-4 cursor-pointer hover:text-slate-300"
      >
        Back to Dashboard
      </button>
    </div>
  );
}
