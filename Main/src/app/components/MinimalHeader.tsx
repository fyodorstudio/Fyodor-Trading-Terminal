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

      {/* OPTION C: PROFESSIONAL TICKER PANEL */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden bg-gray-900 border-b border-gray-800 fixed top-12 left-0 right-0 z-40 shadow-2xl"
          >
            <div className="max-w-[1460px] mx-auto">
              <div className="flex items-stretch divide-x divide-gray-800">
                
                {/* 1. SESSION HEATMAP TAPE */}
                <div className="flex-1 p-4 px-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="h-3 w-3 text-blue-400" />
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Market Liquidity Heatmap</span>
                    </div>
                    <span className="text-[9px] font-bold text-blue-400 tabular-nums uppercase">Current Hour: {currentHour}:00 UTC</span>
                  </div>
                  
                  <div className="relative h-6 bg-black/40 rounded border border-gray-800 flex items-center px-1">
                    {/* Hour Markers */}
                    <div className="absolute inset-0 flex justify-between px-2 items-center pointer-events-none">
                      {[0, 4, 8, 12, 16, 20].map(h => (
                        <span key={h} className="text-[7px] font-bold text-gray-700">{h}h</span>
                      ))}
                    </div>
                    {/* Session Bars */}
                    <div className="flex-1 h-3 relative mx-2">
                      {sessions.map(s => {
                        const startPct = (s.start / 24) * 100;
                        const widthPct = ((s.end - s.start) / 24) * 100;
                        const isActive = currentHour >= s.start && currentHour < s.end;
                        return (
                          <div 
                            key={s.name}
                            className={`absolute top-0 bottom-0 rounded-full transition-all duration-500 ${s.color} ${isActive ? 'opacity-100 shadow-[0_0_8px_rgba(255,255,255,0.2)]' : 'opacity-20'}`}
                            style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                          >
                            {isActive && (
                              <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[7px] font-black text-white uppercase whitespace-nowrap">
                                {s.name}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {/* Current Time Needle */}
                      <div 
                        className="absolute top-[-4px] bottom-[-4px] w-0.5 bg-white shadow-[0_0_10px_white] z-10 transition-all duration-1000"
                        style={{ left: `${(currentHour / 24) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. LIVE SIGNAL STREAM */}
                <div className="w-[340px] p-4 px-6 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-3 w-3 text-amber-400" />
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Signal Stream</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-300">EURUSD VOLATILITY</span>
                      <span className="text-[10px] font-black text-green-400 tabular-nums">LOW</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-300">SYSTEM LATENCY</span>
                      <span className="text-[10px] font-black text-blue-400 tabular-nums">14ms</span>
                    </div>
                  </div>
                </div>

                {/* 3. EVENT TICKER */}
                <div className={`w-[400px] p-4 px-6 flex flex-col justify-center transition-colors ${nextHighImpact ? 'bg-blue-900/20' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className={`h-3 w-3 ${nextHighImpact ? 'text-blue-400 fill-blue-400' : 'text-gray-500'}`} />
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-blue-400">Tactical Event Horizon</span>
                  </div>
                  {nextHighImpact ? (
                    <div className="flex items-baseline gap-3">
                      <span className="text-sm font-black text-white uppercase tracking-tight truncate">{nextHighImpact.title}</span>
                      <span className="text-[10px] font-black text-blue-400 uppercase shrink-0">{nextHighImpact.currency}</span>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold text-gray-600 uppercase italic">No active signatures detected</span>
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
