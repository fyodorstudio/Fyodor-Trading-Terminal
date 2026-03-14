import { useState } from "react";
import { formatDateOnly, formatRelativeAge } from "@/app/lib/format";
import { motion, AnimatePresence } from "framer-motion";
import { Database, Calendar, Clock, ArrowRight, CheckCircle2, AlertTriangle, XCircle, Info, ChevronRight } from "lucide-react";
import type { BridgeStatus, CentralBankSnapshot } from "@/app/types";

interface CentralBanksTabProps {
  snapshots: CentralBankSnapshot[];
  logs: string[];
  status: BridgeStatus;
  lastCalendarIngestAt: number | null;
}

function renderValue(value: string | null): string {
  return value && value.trim() !== "" ? value : "N/A";
}

export function CentralBanksTab({
  snapshots,
  logs,
  status,
  lastCalendarIngestAt,
}: CentralBanksTabProps) {
  const [selectedBank, setSelectedBank] = useState<string>(snapshots[0]?.currency || "");
  const currentSnapshot = snapshots.find(s => s.currency === selectedBank) || snapshots[0];

  return (
    <div className="flex flex-col gap-6 max-w-[1460px] mx-auto pb-12">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-bold text-gray-900">Interactive Timeline</h2>
        </div>
        <div className="flex items-center gap-3">
           <div className="px-3 py-1 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Ingest: {formatRelativeAge(lastCalendarIngestAt)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar: Bank Selection */}
        <div className="lg:col-span-4 flex flex-col gap-2">
          {snapshots.map((snapshot) => (
            <button
              key={snapshot.currency}
              onClick={() => setSelectedBank(snapshot.currency)}
              className={`
                flex items-center justify-between p-4 rounded-2xl transition-all duration-300 border
                ${selectedBank === snapshot.currency 
                  ? 'bg-white border-blue-200 shadow-md translate-x-2' 
                  : 'bg-white/40 border-gray-200/50 hover:bg-white/60'}
              `}
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl">{snapshot.flag}</span>
                <div className="text-left">
                  <div className="text-sm font-bold text-gray-900">{snapshot.bankName}</div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{snapshot.currency}</div>
                </div>
              </div>
              {selectedBank === snapshot.currency && <ArrowRight className="h-4 w-4 text-blue-500" />}
            </button>
          ))}
        </div>

        {/* Right Content: Event Timeline & Details */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedBank}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-3xl shadow-sm p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <span className="text-4xl">{currentSnapshot.flag}</span>
                  <div>
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">{currentSnapshot.bankName}</h3>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Primary Policy Node</p>
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border ${
                  currentSnapshot.status === 'ok' ? 'bg-green-50 text-green-700 border-green-100' : 
                  currentSnapshot.status === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                  'bg-red-50 text-red-700 border-red-100'
                }`}>
                  {currentSnapshot.status}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Policy Rate</span>
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-black text-gray-900 leading-none">{renderValue(currentSnapshot.currentPolicyRate)}</span>
                    <span className="text-sm font-bold text-gray-400 italic">from {renderValue(currentSnapshot.previousPolicyRate)}</span>
                  </div>
                </div>
                <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Inflation YoY</span>
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-black text-gray-900 leading-none">{renderValue(currentSnapshot.currentInflationRate)}</span>
                    <span className="text-sm font-bold text-gray-400 italic">from {renderValue(currentSnapshot.previousInflationRate)}</span>
                  </div>
                </div>
              </div>

              <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                Event Timeline
              </h4>

              <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
                {/* Last Rate Release */}
                <div className="relative pl-8">
                  <div className="absolute left-0 top-1.5 h-6 w-6 rounded-full bg-white border-2 border-gray-200 z-10" />
                  <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Last Rate Release</div>
                    <div className="text-sm font-bold text-gray-700">{formatDateOnly(currentSnapshot.lastRateReleaseAt)}</div>
                  </div>
                </div>

                {/* Next Rate Event */}
                <div className="relative pl-8">
                  <div className="absolute left-0 top-1.5 h-6 w-6 rounded-full bg-blue-500 border-2 border-blue-100 z-10 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                  <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                    <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Next Expected Rate Event</div>
                    <div className="text-sm font-bold text-blue-700">
                      {currentSnapshot.nextRateEventAt ? formatDateOnly(currentSnapshot.nextRateEventAt) : "Awaiting Schedule"}
                    </div>
                  </div>
                </div>

                 {/* Last CPI Release */}
                 <div className="relative pl-8">
                  <div className="absolute left-0 top-1.5 h-6 w-6 rounded-full bg-white border-2 border-gray-200 z-10" />
                  <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Last CPI Release</div>
                    <div className="text-sm font-bold text-gray-700">{formatDateOnly(currentSnapshot.lastCpiReleaseAt)}</div>
                  </div>
                </div>

                 {/* Next CPI Event */}
                 <div className="relative pl-8">
                  <div className="absolute left-0 top-1.5 h-6 w-6 rounded-full bg-blue-500 border-2 border-blue-100 z-10 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                  <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                    <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Next Expected CPI Event</div>
                    <div className="text-sm font-bold text-blue-700">
                      {currentSnapshot.nextCpiEventAt ? formatDateOnly(currentSnapshot.nextCpiEventAt) : "Awaiting Schedule"}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Audit Panel */}
      <div className="backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50/30">
          <Info className="h-4 w-4 text-blue-500" />
          <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest">Mapping Audit Log</h3>
        </div>
        <div className="p-4 bg-gray-50/50 font-mono text-[10px] text-gray-500 max-h-32 overflow-auto">
          {logs.length === 0 ? (
            <div className="flex items-center gap-2 text-green-600 font-bold italic">
              <CheckCircle2 className="h-3 w-3" />
              All bridge nodes resolved.
            </div>
          ) : (
            logs.map((line, index) => <div key={index} className="mb-1">{line}</div>)
          )}
        </div>
      </div>
    </div>
  );
}
