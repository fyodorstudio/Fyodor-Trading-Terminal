import { useState } from 'react';
import { ChevronDown, Circle, Clock, Globe, Zap, Activity, Cpu, Gauge, Radio, BarChart3, TrendingUp } from 'lucide-react';
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

  // Heatmap Logic: UTCHours 0-23
  const currentHour = currentTime.getUTCHours();
  const sessions = [
    { name: 'Tokyo', start: 0, end: 9, color: 'bg-emerald-500' },
    { name: 'London', start: 8, end: 17, color: 'bg-blue-500' },
    { name: 'New York', start: 13, end: 22, color: 'bg-amber-500' }
  ];

  return (
    <div className="mb-4">
      {/* Slim top bar */}
      <div className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50">
        <div className="max-w-[1460px] mx-auto px-6">
          <div className="h-12 flex items-center justify-between">
            {/* Left - Direct Stats */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-sm bg-blue-600 shadow-sm" />
                <h1 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-900">Terminal.Core</h1>
              </div>
              <div className="h-4 w-px bg-gray-200" />
              <div className="flex items-center gap-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                <span className="tabular-nums text-gray-900">{formatTime(currentTime)} LCL</span>
                <span className="flex items-center gap-1.5">
                  <div className={`h-1.5 w-1.5 rounded-full ${isMarketOpen ? 'bg-green-500' : 'bg-amber-500'}`} />
                  {isMarketOpen ? 'Active' : 'Standby'}
                </span>
              </div>
            </div>

            {/* Right - Controls */}
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Feed</span>
                  <span className="text-[10px] font-bold text-gray-900 uppercase tracking-tight">{feedStatus}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Nodes</span>
                  <span className="text-[10px] font-bold text-gray-900 uppercase tracking-tight">{resolvedBanks}/8</span>
                </div>
              </div>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className={`flex items-center gap-2 px-3 py-1 rounded border transition-all ${showDetails ? 'bg-gray-900 border-gray-900 text-white' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-400'}`}
              >
                <span className="text-[9px] font-black uppercase tracking-widest">{showDetails ? 'Close' : 'Intel'}</span>
                <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="h-12" />

      {/* OPTION C: PROFESSIONAL TICKER PANEL (Dominant Refit) */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            className="overflow-hidden bg-gray-950 border-b border-gray-800 fixed top-12 left-0 right-0 z-40 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          >
            <div className="max-w-[1460px] mx-auto">
              <div className="flex flex-col md:flex-row items-stretch divide-y md:divide-y-0 md:divide-x divide-gray-800">
                
                {/* 1. SESSION HEATMAP TAPE - MAGNIFIED */}
                <div className="flex-[1.5] p-8 px-10 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Globe className="h-5 w-5 text-blue-400" />
                      <span className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">Global Liquidity Heatmap</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Active Standard</span>
                      <span className="text-sm font-black text-blue-400 tabular-nums uppercase">{currentHour}:00 UTC</span>
                    </div>
                  </div>
                  
                  <div className="relative h-12 bg-black/60 rounded-lg border border-gray-800 flex items-center px-2 shadow-inner">
                    {/* Hour Markers */}
                    <div className="absolute inset-0 flex justify-between px-4 items-center pointer-events-none">
                      {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22].map(h => (
                        <span key={h} className="text-[8px] font-black text-gray-800">{h}h</span>
                      ))}
                    </div>
                    {/* Session Bars */}
                    <div className="flex-1 h-6 relative mx-4">
                      {sessions.map(s => {
                        const startPct = (s.start / 24) * 100;
                        const widthPct = ((s.end - s.start) / 24) * 100;
                        const isActive = currentHour >= s.start && currentHour < s.end;
                        return (
                          <div 
                            key={s.name}
                            className={`absolute top-0 bottom-0 rounded-md transition-all duration-700 ${s.color} ${isActive ? 'opacity-100 shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'opacity-10'}`}
                            style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                          >
                            {isActive && (
                              <motion.div 
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-black text-white uppercase tracking-widest bg-gray-900 px-2 py-0.5 rounded border border-gray-700"
                              >
                                {s.name}
                              </motion.div>
                            )}
                          </div>
                        );
                      })}
                      {/* Current Time Needle */}
                      <div 
                        className="absolute top-[-8px] bottom-[-8px] w-1 bg-white shadow-[0_0_20px_white] z-10 transition-all duration-1000 rounded-full"
                        style={{ left: `${(currentHour / 24) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. LIVE SIGNAL STREAM - ENLARGED */}
                <div className="w-full md:w-[380px] p-8 px-10 flex flex-col justify-center bg-black/20">
                  <div className="flex items-center gap-3 mb-4">
                    <Activity className="h-5 w-5 text-emerald-400" />
                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">Signal Analytics</span>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-end justify-between border-b border-gray-900 pb-2">
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">VOLATILITY</span>
                      <span className="text-2xl font-black text-emerald-400 tabular-nums leading-none tracking-tighter">STABLE</span>
                    </div>
                    <div className="flex items-end justify-between border-b border-gray-900 pb-2">
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">BRIDGE LATENCY</span>
                      <span className="text-2xl font-black text-blue-400 tabular-nums leading-none tracking-tighter">14<span className="text-xs ml-1 uppercase opacity-50">ms</span></span>
                    </div>
                  </div>
                </div>

                {/* 3. EVENT TICKER - DOMINANT */}
                <div className={`flex-1 p-8 px-10 flex flex-col justify-center transition-all duration-500 ${nextHighImpact ? 'bg-blue-600/10 border-l-4 border-blue-500' : ''}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <Zap className={`h-5 w-5 ${nextHighImpact ? 'text-blue-400 fill-blue-400' : 'text-gray-600'}`} />
                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">Tactical Event Horizon</span>
                  </div>
                  {nextHighImpact ? (
                    <div className="flex flex-col">
                      <span className="text-2xl font-black text-white uppercase tracking-tight leading-tight mb-1">{nextHighImpact.title}</span>
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 bg-blue-500 text-[10px] font-black text-white rounded uppercase tracking-widest">{nextHighImpact.currency}</span>
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest animate-pulse">Imminent Signal</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-gray-600">
                      <div className="h-1 w-1 bg-gray-700 rounded-full animate-ping" />
                      <span className="text-xs font-black uppercase tracking-[0.2em] italic">Scanning Market Signatures...</span>
                    </div>
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
