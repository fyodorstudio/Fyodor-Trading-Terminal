import { useState } from 'react';
import { ChevronDown, Circle, Clock, Globe, Zap, Activity, Cpu, Gauge, Radio } from 'lucide-react';
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
                  <Cpu className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <h1 className="text-sm tracking-tight font-black text-gray-900 uppercase">Sovereign HUD</h1>
              </div>
              <div className="hidden md:flex items-center gap-6 text-[10px] text-gray-500 font-black uppercase tracking-widest">
                <span className="tabular-nums flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  {formatTime(currentTime)}
                </span>
                <span className="flex items-center gap-1.5">
                  <div className={`h-1.5 w-1.5 rounded-full ${isMarketOpen ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-amber-500'}`} />
                  {isMarketOpen ? 'Link Live' : 'Link Dormant'}
                </span>
              </div>
            </div>

            {/* Right - Status pills */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex gap-2">
                <div className="px-3 py-1 bg-white/50 backdrop-blur-sm border border-[var(--line)] rounded-full flex items-center gap-2">
                  <Radio className="h-3 w-3 text-blue-500 animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-900">{feedStatus}</span>
                </div>
                <div className="px-3 py-1 bg-gray-900 border border-gray-800 rounded-full flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">{resolvedBanks} NODES</span>
                </div>
              </div>

              <button
                onClick={() => setShowDetails(!showDetails)}
                className={`group flex items-center justify-center w-10 h-8 rounded-full transition-all border ${showDetails ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-200' : 'bg-white border-[var(--line)] hover:border-blue-400'}`}
              >
                <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${showDetails ? 'rotate-180 text-white' : 'text-gray-600'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-14" />

      {/* OPTION B: SOVEREIGN HUD (Blur Focused) */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            className="overflow-hidden fixed top-14 left-0 right-0 z-40"
          >
            <div className="bg-white/40 backdrop-blur-3xl border-b border-gray-200/50 shadow-2xl relative">
              <div className="max-w-[1460px] mx-auto px-6 py-12">
                
                <div className="flex flex-col md:flex-row gap-12 items-start">
                  
                  {/* HUD LINE 1: GLOBAL TIME TAPE */}
                  <div className="flex-1 w-full space-y-6">
                    <div className="flex items-center gap-3">
                      <Globe className="h-4 w-4 text-blue-600" />
                      <span className="text-[11px] font-black text-gray-900 uppercase tracking-[0.3em]">Temporal Alignment</span>
                    </div>
                    <div className="relative h-12 bg-gray-900/5 rounded-full border border-gray-900/10 overflow-hidden flex items-center px-6">
                      <div className="flex-1 grid grid-cols-3 gap-4 text-center">
                        {[
                          { name: 'Tokyo', active: currentTime.getUTCHours() >= 0 && currentTime.getUTCHours() < 9 },
                          { name: 'London', active: currentTime.getUTCHours() >= 8 && currentTime.getUTCHours() < 17 },
                          { name: 'New York', active: currentTime.getUTCHours() >= 13 && currentTime.getUTCHours() < 22 }
                        ].map(s => (
                          <div key={s.name} className="flex flex-col items-center">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${s.active ? 'text-blue-600' : 'text-gray-400'}`}>
                              {s.name}
                            </span>
                            {s.active && <motion.div layoutId="activeDot" className="h-1 w-1 bg-blue-600 rounded-full mt-1 shadow-[0_0_8px_rgba(37,99,235,0.5)]" />}
                          </div>
                        ))}
                      </div>
                      {/* Current Time Indicator Line */}
                      <div className="absolute top-0 bottom-0 w-px bg-blue-500/30 left-1/2 shadow-[0_0_10px_rgba(59,130,246,0.2)]" />
                    </div>
                    <div className="flex justify-between px-2">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Local</span>
                        <span className="text-sm font-black text-gray-900 tabular-nums">{formatTime(currentTime)}</span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Bridge (UTC)</span>
                        <span className="text-sm font-black text-gray-900 tabular-nums">
                          {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* HUD LINE 2: SYSTEM MOOD & ALERTS */}
                  <div className="flex-1 w-full space-y-6 border-l border-gray-900/10 pl-12">
                    <div className="flex items-center gap-3">
                      <Gauge className="h-4 w-4 text-blue-600" />
                      <span className="text-[11px] font-black text-gray-900 uppercase tracking-[0.3em]">Signature Analysis</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between group cursor-help">
                          <span className="text-xs font-bold text-gray-500 group-hover:text-gray-900 transition-colors">Market Volatility</span>
                          <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">Normal</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-900/5 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: '35%' }} className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                        </div>
                      </div>

                      <div className={`p-4 rounded-2xl border-2 transition-all ${nextHighImpact ? 'bg-blue-600 border-blue-500 shadow-xl' : 'bg-gray-900/5 border-transparent'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className={`h-3 w-3 ${nextHighImpact ? 'text-white fill-white' : 'text-blue-500'}`} />
                          <span className={`text-[9px] font-black uppercase tracking-widest ${nextHighImpact ? 'text-blue-100' : 'text-gray-400'}`}>Next Signal</span>
                        </div>
                        {nextHighImpact ? (
                          <div className="text-sm font-black text-white leading-tight uppercase tracking-tight">{nextHighImpact.title}</div>
                        ) : (
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter italic">Scanning...</div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2">
                      <div className="flex flex-wrap gap-2">
                        {['FED', 'ECB', 'BOE', 'BOJ', 'RBA'].map(bank => (
                          <div key={bank} className="px-2 py-1 bg-white border border-gray-900/10 rounded-md flex flex-col items-center min-w-[50px]">
                            <span className="text-[8px] font-black text-gray-400 mb-0.5">{bank}</span>
                            <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-400" style={{ width: '50%' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
