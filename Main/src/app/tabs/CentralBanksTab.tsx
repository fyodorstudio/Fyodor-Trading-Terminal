import { formatDateOnly, formatRelativeAge } from "@/app/lib/format";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Clock, Activity, AlertCircle, Database, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
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

function StatusIcon({ status }: { status: "ok" | "partial" | "missing" }) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === "partial") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-red-500" />;
}

export function CentralBanksTab({
  snapshots,
  logs,
  status,
  lastCalendarIngestAt,
}: CentralBanksTabProps) {
  const okCount = snapshots.filter((item) => item.status === "ok").length;
  const partialCount = snapshots.filter((item) => item.status === "partial").length;
  const missingCount = snapshots.filter((item) => item.status === "missing").length;

  return (
    <div className="flex flex-col gap-8 max-w-[1460px] mx-auto pb-12">
      {/* Top Header & Metrics Bar */}
      <div className="flex flex-wrap items-center justify-between gap-6 p-6 backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-2xl shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            Central Banks Data
            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100 uppercase tracking-widest font-bold">Verified</span>
          </h2>
          <p className="text-sm text-gray-500 font-medium italic">Derived strictly from MT5 calendar events for the major eight currencies.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-gray-50 border border-gray-100 rounded-2xl p-1 gap-1">
             <div className="px-4 py-2 flex items-center gap-2">
               <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Resolution</span>
               <div className="flex gap-2">
                 <span className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-100 rounded-xl text-sm font-bold text-green-600 shadow-sm">{okCount} OK</span>
                 <span className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-100 rounded-xl text-sm font-bold text-amber-600 shadow-sm">{partialCount} Partial</span>
               </div>
             </div>
          </div>
          
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-800 rounded-full shadow-lg">
            <Database className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-bold text-gray-300 whitespace-nowrap">
              Calendar Ingest: {formatRelativeAge(lastCalendarIngestAt)}
            </span>
          </div>
        </div>
      </div>

      {/* The Institutional Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {snapshots.map((snapshot, index) => (
          <motion.div
            key={snapshot.currency}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="group relative flex flex-col p-6 backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-3xl shadow-sm hover:shadow-xl hover:bg-white/80 transition-all duration-300 overflow-hidden"
          >
            {/* Background Currency Symbol Decoration */}
            <div className="absolute -top-4 -right-2 text-8xl font-black text-gray-100/40 select-none group-hover:text-gray-200/40 transition-colors z-0">
              {snapshot.currency}
            </div>

            <div className="relative z-10">
              {/* Card Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 flex items-center justify-center bg-white border border-gray-100 rounded-xl text-lg shadow-sm group-hover:scale-110 transition-transform">
                    {snapshot.flag}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 tracking-tight">{snapshot.bankName}</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{snapshot.currency}</p>
                  </div>
                </div>
                <StatusIcon status={snapshot.status} />
              </div>

              {/* Main Policy Rate Section */}
              <div className="mb-6 p-4 bg-white/40 border border-white/60 rounded-2xl">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Policy Rate</span>
                  {snapshot.currentPolicyRate && snapshot.previousPolicyRate && (
                    <div className="flex items-center gap-1">
                      {parseFloat(snapshot.currentPolicyRate) > parseFloat(snapshot.previousPolicyRate) ? (
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      ) : parseFloat(snapshot.currentPolicyRate) < parseFloat(snapshot.previousPolicyRate) ? (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      ) : null}
                    </div>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-gray-900 tracking-tighter">
                    {renderValue(snapshot.currentPolicyRate)}
                  </span>
                  <span className="text-xs font-bold text-gray-400">
                    Prev: {renderValue(snapshot.previousPolicyRate)}
                  </span>
                </div>
              </div>

              {/* Inflation Grid */}
              <div className="grid grid-cols-1 gap-4 mb-6">
                <div className="p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Inflation (YoY)</div>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-gray-800">{renderValue(snapshot.currentInflationRate)}</span>
                    <span className="text-[10px] font-medium text-gray-400 italic">Prev: {renderValue(snapshot.previousInflationRate)}</span>
                  </div>
                </div>
              </div>

              {/* Event Timeline */}
              <div className="space-y-3 pt-4 border-t border-gray-100">
                <div className="flex items-start gap-3 text-[11px]">
                  <Clock className="h-3.5 w-3.5 text-gray-400 mt-0.5" />
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-col">
                      <span className="text-gray-400 font-bold uppercase tracking-tighter text-[9px]">Last Rate Release</span>
                      <span className="text-gray-700 font-medium">{formatDateOnly(snapshot.lastRateReleaseAt)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-400 font-bold uppercase tracking-tighter text-[9px]">Next Expected Event</span>
                      <span className="text-blue-600 font-bold">
                        {snapshot.nextRateEventAt ? formatDateOnly(snapshot.nextRateEventAt) : "Awaiting Schedule"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Mapping Audit Panel */}
      <div className="backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-3xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
            Central Bank Mapping Audit
          </h3>
          <div className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            {logs.length === 0 ? "Resolved" : `${logs.length} Mapping Issues`}
          </div>
        </div>
        <div className="max-h-48 overflow-auto p-6 bg-gray-50/50 font-mono text-[11px] leading-relaxed text-gray-600">
          {logs.length === 0 ? (
            <div className="flex items-center gap-2 text-green-600 font-bold italic">
              <CheckCircle2 className="h-4 w-4" />
              All eight currency mappings resolved successfully with the current MT5 bridge feed.
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((line, index) => (
                <div key={`${line}-${index}`} className="flex items-start gap-2">
                  <span className="text-gray-400">[{index + 1}]</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
