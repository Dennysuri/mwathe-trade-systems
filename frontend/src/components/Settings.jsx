import { useState } from 'react'
import { Moon, Sun, Volume2, VolumeX, Wifi, WifiOff, RefreshCw } from 'lucide-react'

export default function Settings() {
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [soundsEnabled, setSoundsEnabled] = useState(true)
  const [isConnected, setIsConnected] = useState(true)

  return (
    <div className="p-4 space-y-4">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-mwathe-white">Settings</h2>
        <p className="text-mwathe-gray text-sm">Configure your trading environment</p>
      </div>

      {/* Display Mode */}
      <div className="bg-mwathe-darkgray rounded-xl p-4 border border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isDarkMode ? <Moon className="text-mwathe-skyblue" size={20} /> : <Sun className="text-mwathe-orange" size={20} />}
          <div>
            <p className="text-mwathe-white font-medium text-sm">Display Mode</p>
            <p className="text-mwathe-gray text-xs">{isDarkMode ? 'Dark Mode' : 'Light Mode'}</p>
          </div>
        </div>
        <button 
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={`w-12 h-6 rounded-full p-1 transition-colors ${isDarkMode ? 'bg-mwathe-green' : 'bg-gray-600'}`}
        >
          <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
        </button>
      </div>

      {/* Notification Sounds */}
      <div className="bg-mwathe-darkgray rounded-xl p-4 border border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {soundsEnabled ? <Volume2 className="text-mwathe-green" size={20} /> : <VolumeX className="text-mwathe-gray" size={20} />}
          <div>
            <p className="text-mwathe-white font-medium text-sm">Notification Sounds</p>
            <p className="text-mwathe-gray text-xs">Won, Lost, Target, Stop Loss</p>
          </div>
        </div>
        <button 
          onClick={() => setSoundsEnabled(!soundsEnabled)}
          className={`w-12 h-6 rounded-full p-1 transition-colors ${soundsEnabled ? 'bg-mwathe-green' : 'bg-gray-600'}`}
        >
          <div className={`w-4 h-4 bg-white rounded-full transition-transform ${soundsEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
        </button>
      </div>

      {/* Chart Theme */}
      <div className="bg-mwathe-darkgray rounded-xl p-4 border border-gray-800">
        <p className="text-mwathe-white font-medium text-sm mb-3">Chart Theme</p>
        <div className="grid grid-cols-3 gap-2">
          <button className="py-2 rounded-lg bg-mwathe-black border border-mwathe-skyblue text-mwathe-skyblue text-xs font-bold">Dark</button>
          <button className="py-2 rounded-lg bg-mwathe-black border border-gray-700 text-mwathe-gray text-xs font-bold">Light</button>
          <button className="py-2 rounded-lg bg-mwathe-black border border-gray-700 text-mwathe-gray text-xs font-bold">High Contrast</button>
        </div>
      </div>

      {/* Deriv Connection */}
      <div className="bg-mwathe-darkgray rounded-xl p-4 border border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {isConnected ? <Wifi className="text-mwathe-green" size={20} /> : <WifiOff className="text-red-500" size={20} />}
            <div>
              <p className="text-mwathe-white font-medium text-sm">Deriv Connection</p>
              <p className="text-mwathe-gray text-xs">{isConnected ? 'OAuth 2.0 Active' : 'Disconnected'}</p>
            </div>
          </div>
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-mwathe-green animate-pulse' : 'bg-red-500'}`}></div>
        </div>
        <button 
          onClick={() => setIsConnected(!isConnected)}
          className="w-full py-2 rounded-lg bg-mwathe-black border border-gray-700 text-mwathe-orange text-sm font-bold flex items-center justify-center gap-2 hover:bg-gray-800"
        >
          <RefreshCw size={14} /> {isConnected ? 'Re-authorize Session' : 'Connect to Deriv'}
        </button>
      </div>
    </div>
  )
}
