import { useState, useEffect } from 'react';
import { ChevronDown, Circle } from 'lucide-react';
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
      <div className="backdrop-blur-xl bg-white/80 border-b border-gray-200/50 fixed top-0 left-0 right-0 z-50">
        <div className="max-w-[1460px] mx-auto px-6">
          <div className="h-14 flex items-center justify-between">
            {/* Left - Logo/Title */}
            <div className="flex items-center gap-8">
              <h1 className="text-sm tracking-tight font-bold text-gray-900">Fyodor Trading Terminal</h1>
              <div className="hidden md:flex items-center gap-6 text-xs text-gray-500 font-medium">
                <span className="tabular-nums">{formatTime(currentTime)}</span>
                <span className="flex items-center gap-1.5">
                  <Circle className={`h-1.5 w-1.5 fill-current ${isMarketOpen ? 'text-green-500' : 'text-amber-500'}`} />
                  {isMarketOpen ? 'Market Open' : 'Market Closed'}
                </span>
              </div>
            </div>

            {/* Right - Status pills */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex gap-2">
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  feedStatus === 'live' ? 'bg-green-50 text-green-700 border border-green-100' : 
                  feedStatus === 'stale' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 
                  'bg-red-50 text-red-700 border border-red-100'
                }`}>
                  {headerStatus}
                </span>
                <span className="px-2 py-1 rounded-full bg-gray-50 text-gray-600 text-[10px] font-bold border border-gray-100 uppercase tracking-wider">
                  {resolvedBanks}/8 Banks
                </span>
              </div>

              <button
                onClick={() => setShowDetails(!showDetails)}
                className="group flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100/60 hover:bg-gray-200/80 transition-all"
              >
                <ChevronDown className={`h-4 w-4 text-gray-600 transition-transform duration-300 ${showDetails ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-14" />

      {/* Expandable details panel */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden backdrop-blur-xl bg-white/80 border-b border-gray-200/50"
          >
            <div className="max-w-[1460px] mx-auto px-6 py-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
                <div>
                  <div className="text-gray-400 uppercase tracking-wider text-[10px] font-bold mb-3">Time Zones</div>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Local Time</span>
                      <span className="tabular-nums text-gray-900 font-bold">{formatTime(currentTime)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">MT5 Time</span>
                      <span className="tabular-nums text-gray-900 font-bold">22:59 UTC</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-gray-400 uppercase tracking-wider text-[10px] font-bold mb-3">Feed Status</div>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 font-medium">Calendar Connection</span>
                      <span className="flex items-center gap-2">
                        <Circle className={`h-2 w-2 fill-current ${feedStatus === 'live' ? 'text-green-500' : 'text-amber-500'}`} />
                        <span className="text-gray-900 font-bold capitalize">{feedStatus}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 font-medium">Banks Resolution</span>
                      <span className="text-gray-900 font-bold">{resolvedBanks} of 8</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-gray-400 uppercase tracking-wider text-[10px] font-bold mb-3">Coming Up Next</div>
                  {nextHighImpact ? (
                    <>
                      <div className="text-gray-900 font-bold leading-snug mb-1">{nextHighImpact.title}</div>
                      <div className="text-gray-500 text-xs font-medium uppercase tracking-tight">{nextHighImpact.currency} • High Impact Event</div>
                    </>
                  ) : (
                    <div className="text-gray-400 italic font-medium">No high impact events soon</div>
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
