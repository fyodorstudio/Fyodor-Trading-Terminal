import { useState } from 'react';
import { ChevronDown, Circle, Clock, Globe, Zap, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MinimalHeaderProps {
  currentTime: Date;
  headerStatus: string;
  feedStatus: string;
  marketStatus: any;
  resolvedBanks: number;
  nextHighImpact?: { title: string; currency: string } | null;
}

export function MinimalHeader({
  currentTime,
  headerStatus,
  feedStatus,
  marketStatus,
  resolvedBanks,
  nextHighImpact
}: MinimalHeaderProps) {
  const [showDetails, setShowDetails] = useState(false);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const isMarketOpen = marketStatus?.status === 'open';

  // Session Logic (Simplified for Visuals)
  const getSessionStatus = (start: number, end: number) => {
    const hour = currentTime.getUTCHours();
    return hour >= start && hour < end;
  };

  return (
    <div className="mb-4">
      {/* Slim top bar */}
      <div className="bg-[var(--bg)] border-b border-[var(--line)] fixed top-0 left-0 right-0 z-50 transition-colors duration-300">
        <div className="max-w-[1460px] mx-auto px-6">
          <div className="h-14 flex items-center justify-between">
            {/* Left - Logo/Title */}
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-gray-900 rounded-lg shadow-lg">
                  <Zap className="h-3.5 w-3.5 text-blue-400 fill-blue-400" />
                </div>
                <h1 className="text-sm tracking-tight font-black text-gray-900 uppercase">Fyodor Terminal</h1>
              </div>
              <div className="hidden md:flex items-center gap-6 text-[10px] text-gray-500 font-black uppercase tracking-widest">
                <span className="tabular-nums flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  {formatTime(currentTime)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Circle className={`h-1.5 w-1.5 fill-current ${isMarketOpen ? 'text-green-500' : 'text-amber-500'}`} />
                  {isMarketOpen ? 'Market Open' : 'Market Closed'}
                </span>
              </div>
            </div>

            {/* Right - Status pills */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex gap-2">
                <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border transition-colors ${
                  feedStatus === 'live' ? 'bg-green-50 text-green-700 border-green-100' : 
                  feedStatus === 'stale' ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                  'bg-red-50 text-red-700 border-red-100'
                }`}>
                  {headerStatus}
                </span>
                <span className="px-2.5 py-1 rounded-md bg-[var(--panel)] text-[var(--muted)] text-[9px] font-black border border-[var(--line)] uppercase tracking-widest">
                  {resolvedBanks}/8 Sovereign Nodes
                </span>
              </div>

              <button
                onClick={() => setShowDetails(!showDetails)}
                className={`group flex items-center justify-center w-8 h-8 rounded-lg transition-all border ${showDetails ? 'bg-gray-900 border-gray-800' : 'bg-[var(--panel)] border-[var(--line)] hover:border-gray-400'}`}
              >
                <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${showDetails ? 'rotate-180 text-white' : 'text-gray-600'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-14" />

      {/* OPTION A: QUANT BENTO PANEL */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="overflow-hidden bg-[var(--panel)] border-b border-[var(--line)] shadow-xl relative z-40"
          >
            <div className="max-w-[1460px] mx-auto px-6 py-10">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                
                {/* Cell 1: Global Sessions */}
                <div className="bg-white border border-[var(--line)] rounded-2xl p-5 flex flex-col justify-between hover:border-blue-300 transition-colors">
                  <div className="flex items-center gap-2 mb-4">
                    <Globe className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Global Sessions</span>
                  </div>
                  <div className="space-y-3">
                    {[
                      { name: 'Tokyo', hours: '00-09', active: getSessionStatus(0, 9) },
                      { name: 'London', hours: '08-17', active: getSessionStatus(8, 17) },
                      { name: 'New York', hours: '13-22', active: getSessionStatus(13, 22) }
                    ].map(s => (
                      <div key={s.name} className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${s.active ? 'text-gray-900' : 'text-gray-400'}`}>{s.name}</span>
                        <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                          {s.active ? 'Active' : s.hours}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cell 2: Time Management */}
                <div className="bg-white border border-[var(--line)] rounded-2xl p-5 flex flex-col justify-between hover:border-blue-300 transition-colors">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Chronos Engine</span>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Local Terminal</div>
                      <div className="text-xl font-black text-gray-900 tabular-nums">{formatTime(currentTime)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Bridge Time (UTC)</div>
                      <div className="text-xl font-black text-gray-900 tabular-nums">
                        {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cell 3: Bridge Status */}
                <div className="bg-white border border-[var(--line)] rounded-2xl p-5 flex flex-col justify-between hover:border-blue-300 transition-colors">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sovereign Intel</span>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <span className="text-xs font-bold text-gray-600">Feed Health</span>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${feedStatus === 'live' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-amber-500'}`} />
                        <span className="text-[10px] font-black uppercase text-gray-900">{feedStatus}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <span className="text-xs font-bold text-gray-600">Nodes Resolved</span>
                      <span className="text-[10px] font-black text-gray-900 uppercase">{resolvedBanks} / 8</span>
                    </div>
                  </div>
                </div>

                {/* Cell 4: Tactical Alert */}
                <div className={`rounded-2xl p-5 flex flex-col justify-between border-2 transition-all ${nextHighImpact ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-200' : 'bg-white border-[var(--line)]'}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className={`h-3.5 w-3.5 ${nextHighImpact ? 'text-white fill-white' : 'text-blue-500'}`} />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${nextHighImpact ? 'text-blue-100' : 'text-gray-400'}`}>Next High Impact</span>
                  </div>
                  {nextHighImpact ? (
                    <div>
                      <div className="text-lg font-black text-white leading-tight mb-1">{nextHighImpact.title}</div>
                      <div className="inline-block px-2 py-0.5 bg-white/20 rounded text-[9px] font-black text-white uppercase tracking-tighter">
                        {nextHighImpact.currency} Protocol Alert
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-400 italic text-xs font-bold">Scanning for high-impact signatures...</div>
                  )}
                </div>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
