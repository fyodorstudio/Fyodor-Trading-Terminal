import { useState, useEffect } from 'react';
import { ChevronDown, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function MinimalHeader() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showDetails, setShowDetails] = useState(false);
  const [marketClosesIn, setMarketClosesIn] = useState({ hours: 16, minutes: 8 });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      setMarketClosesIn(prev => {
        const totalMinutes = prev.hours * 60 + prev.minutes - 1;
        if (totalMinutes <= 0) return { hours: 0, minutes: 0 };
        return {
          hours: Math.floor(totalMinutes / 60),
          minutes: totalMinutes % 60
        };
      });
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  return (
    <div className="mb-12">
      {/* Slim top bar */}
      <div className="backdrop-blur-xl bg-white/80 border-b border-gray-200/50 fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="h-14 flex items-center justify-between">
            {/* Left - Logo/Title */}
            <div className="flex items-center gap-8">
              <h1 className="text-sm tracking-tight font-medium">Fyodor Trading Terminal</h1>
              <div className="hidden md:flex items-center gap-6 text-xs text-gray-500">
                <span className="tabular-nums">{formatTime(currentTime)}</span>
                <span className="flex items-center gap-1.5">
                  <Circle className="h-1.5 w-1.5 fill-green-500 text-green-500" />
                  Market Open
                </span>
              </div>
            </div>

            {/* Right - Status pills */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="group flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100/60 hover:bg-gray-200/80 transition-all"
              >
                <ChevronDown className={`h-4 w-4 text-gray-600 transition-transform duration-300 ${showDetails ? 'rotate-180' : ''}`} />
              </button>
              
              <div className="hidden sm:block px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-xs border border-amber-100">
                1 Alert
              </div>
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
            <div className="max-w-7xl mx-auto px-6 py-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
                <div>
                  <div className="text-gray-500 uppercase tracking-wider text-[11px] font-semibold mb-3">Time Zones</div>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-medium">Local</span>
                      <span className="tabular-nums text-gray-900">{formatTime(currentTime)} Asia/Jakarta</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-medium">MT5</span>
                      <span className="tabular-nums text-gray-900">22:59 UTC</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-gray-500 uppercase tracking-wider text-[11px] font-semibold mb-3">System Status</div>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 font-medium">Charts</span>
                      <span className="flex items-center gap-2">
                        <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                        <span className="text-gray-900">Operational</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 font-medium">Calendar Feed</span>
                      <span className="flex items-center gap-2">
                        <Circle className="h-2 w-2 fill-amber-500 text-amber-500" />
                        <span className="text-gray-900">Stale</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 font-medium">Data Sync</span>
                      <span className="flex items-center gap-2">
                        <Circle className="h-2 w-2 fill-red-500 text-red-500" />
                        <span className="text-gray-900">Error</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-gray-500 uppercase tracking-wider text-[11px] font-semibold mb-3">Next Event</div>
                  <div className="text-gray-900 font-medium leading-snug mb-1">Electronic Card Retail Sales</div>
                  <div className="text-gray-700 text-sm">NZD • High Impact • 2h 15m</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}