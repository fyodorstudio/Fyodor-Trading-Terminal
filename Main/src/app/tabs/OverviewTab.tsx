import { motion } from "framer-motion";
import { 
  Activity, 
  Cpu, 
  Zap, 
  Globe, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Clock, 
  Layers,
  ShieldCheck,
  ZapOff
} from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import type { MarketStatusResponse, BridgeStatus, CentralBankSnapshot } from "@/app/types";

interface OverviewTabProps {
  marketStatus: MarketStatusResponse | null;
  feedStatus: BridgeStatus;
  snapshots: CentralBankSnapshot[];
  currentTime: Date;
}

export function OverviewTab({
  marketStatus,
  feedStatus,
  snapshots,
  currentTime
}: OverviewTabProps) {
  const isMarketOpen = marketStatus?.is_open;
  
  // Heatmap Logic: UTCHours 0-23
  const currentHour = currentTime.getUTCHours();
  const sessions = [
    { name: 'Tokyo', start: 0, end: 9, color: 'bg-emerald-500', icon: '🇯🇵' },
    { name: 'London', start: 8, end: 17, color: 'bg-blue-500', icon: '🇬🇧' },
    { name: 'New York', start: 13, end: 22, color: 'bg-amber-500', icon: '🇺🇸' }
  ];

  // Mock Currency Strength (Placeholder for Phase Two)
  const currencyStrength = [
    { code: 'USD', strength: 0.85, trend: 'up', country: 'US' },
    { code: 'EUR', strength: -0.42, trend: 'down', country: 'EU' },
    { code: 'JPY', strength: 0.12, trend: 'up', country: 'JP' },
    { code: 'GBP', strength: 0.64, trend: 'up', country: 'GB' },
    { code: 'AUD', strength: -0.15, trend: 'down', country: 'AU' },
    { code: 'CAD', strength: 0.33, trend: 'up', country: 'CA' },
    { code: 'CHF', strength: -0.08, trend: 'down', country: 'CH' },
    { code: 'NZD', strength: 0.51, trend: 'up', country: 'NZ' }
  ];

  // Mock Tactical Intel (Placeholder for Phase Two)
  const tacticalIntel = [
    { id: 1, type: 'volatility', title: 'JPY Volatility Spike', desc: 'BoJ unexpected commentary.', time: '14m ago', impact: 'high' },
    { id: 2, type: 'liquidity', title: 'USD Liquidity Inflow', desc: 'NY Open institutional flow.', time: '28m ago', impact: 'medium' },
    { id: 3, type: 'signal', title: 'EUR Trend Weakness', desc: 'Resistance at 1.0850 hold.', time: '1h ago', impact: 'low' }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6 pb-12"
    >
      {/* 1. TOP PULSE BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-2xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-gray-900 rounded-xl shadow-lg">
            <Activity className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">Global Market Pulse</h2>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Real-time Tactical Overview</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Bridge Latency</span>
            <span className="text-sm font-black text-blue-600 tabular-nums">14ms <span className="text-[10px] text-gray-400 uppercase">Stable</span></span>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Market State</span>
            <span className={`text-sm font-black uppercase ${isMarketOpen ? 'text-green-600' : 'text-amber-600'}`}>
              {isMarketOpen ? 'Active' : 'Standby'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. BENTO GRID DASHBOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Market Status Card (4 columns) */}
        <div className="lg:col-span-4 backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-3xl p-6 shadow-sm flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Cpu className="h-5 w-5 text-blue-500" />
            <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">System Nodes</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white/80 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${feedStatus === 'live' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-sm font-bold text-gray-700">Calendar Feed</span>
              </div>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${feedStatus === 'live' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {feedStatus}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/80 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-bold text-gray-700">MT5 Bridge</span>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                Connected
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/80 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3">
                <Globe className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-bold text-gray-700">Policy Nodes</span>
              </div>
              <span className="text-sm font-black text-gray-900">
                {snapshots.filter(s => s.status === 'ok').length}/8
              </span>
            </div>
          </div>
        </div>

        {/* Session Timeline Card (8 columns) */}
        <div className="lg:col-span-8 backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-3xl p-6 shadow-sm flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-500" />
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Global Session Cycle</h3>
            </div>
            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              {currentHour}:00 UTC
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-center gap-8 py-4">
            <div className="relative h-12 bg-gray-100/50 rounded-2xl border border-gray-200/50 flex items-center px-4">
              {/* Hour Markers */}
              <div className="absolute inset-0 flex justify-between px-6 items-center pointer-events-none">
                {[0, 4, 8, 12, 16, 20].map(h => (
                  <span key={h} className="text-[8px] font-black text-gray-400">{h}h</span>
                ))}
              </div>
              
              {/* Session Bars */}
              <div className="flex-1 h-6 relative mx-2">
                {sessions.map(s => {
                  const startPct = (s.start / 24) * 100;
                  const widthPct = ((s.end - s.start) / 24) * 100;
                  const isActive = currentHour >= s.start && currentHour < s.end;
                  return (
                    <div 
                      key={s.name}
                      className={`absolute top-0 bottom-0 rounded-lg transition-all duration-700 ${s.color} ${isActive ? 'opacity-100 shadow-lg' : 'opacity-20'}`}
                      style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                    />
                  );
                })}
                {/* Current Time Needle */}
                <div 
                  className="absolute top-[-8px] bottom-[-8px] w-1 bg-gray-900 shadow-xl z-10 transition-all duration-1000 rounded-full"
                  style={{ left: `${(currentHour / 24) * 100}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {sessions.map(s => {
                const isActive = currentHour >= s.start && currentHour < s.end;
                return (
                  <div key={s.name} className={`p-4 rounded-2xl border transition-all ${isActive ? 'bg-white border-gray-200 shadow-sm' : 'bg-transparent border-transparent opacity-50'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-gray-900">{s.name}</span>
                      <span className="text-lg">{s.icon}</span>
                    </div>
                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">
                      {s.start}:00 - {s.end}:00 UTC
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Currency Strength Heatmap (8 columns) */}
        <div className="lg:col-span-8 backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-3xl p-6 shadow-sm flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Layers className="h-5 w-5 text-blue-500" />
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Relative Strength Index</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Phase Two Preview</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {currencyStrength.map((curr) => (
              <div key={curr.code} className="p-4 bg-white/80 border border-gray-100 rounded-2xl shadow-sm hover:border-blue-200 transition-all group">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FlagIcon countryCode={curr.country} className="h-4 w-6 rounded-sm shadow-sm" />
                    <span className="text-sm font-black text-gray-900">{curr.code}</span>
                  </div>
                  {curr.trend === 'up' ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <div className="flex items-end justify-between">
                  <div className="h-2 flex-1 bg-gray-100 rounded-full overflow-hidden mr-3">
                    <div 
                      className={`h-full rounded-full ${curr.strength > 0 ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{ 
                        width: `${Math.abs(curr.strength) * 100}%`,
                        marginLeft: curr.strength > 0 ? '0' : 'auto' 
                      }}
                    />
                  </div>
                  <span className={`text-xs font-black tabular-nums ${curr.strength > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {curr.strength > 0 ? '+' : ''}{curr.strength.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tactical Intel Feed (4 columns) */}
        <div className="lg:col-span-4 backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-3xl p-6 shadow-sm flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-amber-500" />
            <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Tactical Intel</h3>
          </div>

          <div className="space-y-4">
            {tacticalIntel.map((intel) => (
              <div key={intel.id} className="relative pl-4 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-1 before:rounded-full before:bg-amber-400/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">{intel.title}</span>
                  <span className="text-[9px] font-bold text-gray-400 tabular-nums uppercase">{intel.time}</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-tight">{intel.desc}</p>
              </div>
            ))}
          </div>

          <button className="mt-auto w-full py-3 bg-gray-900 text-[10px] font-black text-white uppercase tracking-[0.2em] rounded-xl shadow-lg hover:bg-gray-800 transition-all flex items-center justify-center gap-2">
            <Layers className="h-3 w-3" />
            Expand Tactical View
          </button>
        </div>

      </div>
    </motion.div>
  );
}
