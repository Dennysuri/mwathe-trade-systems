import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function Dashboard() {
  const navigate = useNavigate()

  return (
    <div className="h-screen w-screen bg-mwathe-black flex flex-col items-center justify-between px-6 py-10 overflow-hidden">
      <div className="flex-1"></div>
      
      <motion.div 
        className="flex flex-col items-center gap-6"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        {/* Large Centered Logo */}
        <motion.div 
          className="w-40 h-40 mb-4"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <img src="/logo.svg" alt="Mwathe Trade Systems" className="w-full h-full drop-shadow-2xl" />
        </motion.div>

        {/* App Name */}
        <div className="flex flex-col items-center">
          <h1 className="text-5xl font-black tracking-tight">
            <span className="text-mwathe-orange">M</span>
            <span className="text-mwathe-green">W</span>
            <span className="text-mwathe-skyblue">A</span>
            <span className="text-mwathe-white">T</span>
            <span className="text-mwathe-orange">H</span>
            <span className="text-mwathe-green">E</span>
          </h1>
          <h2 className="text-lg font-semibold tracking-widest mt-1">
            <span className="text-mwathe-skyblue">TRADE </span>
            <span className="text-mwathe-gray">SYSTEMS</span>
          </h2>
        </div>
        
        <div className="w-32 h-1 rounded-full bg-gradient-to-r from-mwathe-orange via-mwathe-green to-mwathe-skyblue"></div>
        
        <p className="text-mwathe-gray text-center text-sm max-w-xs leading-relaxed">
          Institutional-grade AI trading engine. 
          Zero consecutive losses. 
          Unmatched precision across all Deriv markets.
        </p>
      </motion.div>

      <div className="flex-1"></div>

      <motion.div
        className="w-full max-w-xs mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4 }}
      >
        <button
          onClick={() => navigate('/navigation')}
          className="w-full py-4 rounded-xl text-lg font-bold text-white bg-gradient-to-r from-mwathe-orange to-mwathe-green shadow-lg shadow-mwathe-orange/30 active:scale-95 transition-transform"
        >
          Get Started
        </button>
      </motion.div>
    </div>
  )
}
