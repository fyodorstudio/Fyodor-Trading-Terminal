import { useState } from "react";
import { formatDateOnly, formatRelativeAge } from "@/app/lib/format";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Database, 
  Calendar, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Minus, 
  Info, 
  LayoutGrid, 
  List,
  Target
} from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import type { BridgeStatus, CentralBankSnapshot } from "@/app/types";

interface CentralBanksTabProps {
  snapshots: CentralBankSnapshot[];
  logs: string[];
  status: BridgeStatus;
  lastCalendarIngestAt: number | null;
}

type ViewMode = 'command' | 'focus';

function renderValue(value: string | null): string {
  return value && value.trim() !== "" ? value : "N/A";
}

function renderSourceLabel(source: CentralBankSnapshot["policyRateSource"]): string {
  if (source === "released_actual") return "Released actual";
  if (source === "upcoming_previous") return "Upcoming previous";
  return "Unresolved";
}

function TrendIndicator({ current, previous }: { current: string | null; previous: string | null }) {
  if (!current || !previous) return <Minus className="h-3 w-3 text-gray-300" />;
  const c = parseFloat(current);
  const p = parseFloat(previous);
  if (c > p) return <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />;
  if (c < p) return <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3 w-3 text-gray-300" />;
}

export function CentralBanksTab({
  snapshots,
  logs,
  status,
  lastCalendarIngestAt,
}: CentralBanksTabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('focus');
  const [selectedBank, setSelectedBank] = useState<string>(snapshots[0]?.currency || "");
  
  const okCount = snapshots.filter((item) => item.status === "ok").length;
  const currentSnapshot = snapshots.find(s => s.currency === selectedBank) || snapshots[0];

  return (
    <div className="flex flex-col gap-6 max-w-[1460px] mx-auto pb-12">
      {/* Top Controller Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-2xl shadow-sm relative z-50">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-gray-900 rounded-xl shadow-lg">
            <Database className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">Central Bank Intelligence</h2>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Global Policy Monitoring</p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex bg-gray-100 p-1.5 rounded-xl gap-1 border border-gray-200/30">
          <button
            onClick={() => setViewMode('command')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'command' 
                ? 'bg-white shadow-md text-gray-900' 
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Detailed Command
          </button>
          <button
            onClick={() => setViewMode('focus')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'focus' 
                ? 'bg-white shadow-md text-gray-900' 
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Target className="h-3.5 w-3.5" />
            Strategic Focus
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl shadow-sm">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Resolution</span>
            <span className="text-sm font-bold text-gray-900">{okCount}/8 <span className="text-gray-400 text-xs">Nodes</span></span>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'command' ? (
          /* OPTION B: COMMAND CENTER (Detailed) */
          <motion.div
            key="command-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-2xl shadow-sm overflow-hidden"
          >
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Institution</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Current Rate</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Previous</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Trend</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Last Release</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Next Event</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Inflation</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {snapshots.map((snapshot, index) => (
                  <motion.tr 
                    key={snapshot.currency}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="hover:bg-white/80 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <FlagIcon countryCode={snapshot.countryCode} className="h-4 w-6 shadow-sm flex-shrink-0" />
                        <div>
                          <div className="text-sm font-bold text-gray-900">{snapshot.bankName}</div>
                          <div className="text-[10px] font-black text-gray-400 uppercase tracking-tight">{snapshot.currency}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-lg font-black text-gray-900 tracking-tight leading-none mb-1">
                          {renderValue(snapshot.currentPolicyRate)}
                        </span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">
                          {renderSourceLabel(snapshot.policyRateSource)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-gray-600">
                        {renderValue(snapshot.previousPolicyRate)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <div className="p-1.5 bg-white rounded-lg border border-gray-100 shadow-sm">
                          <TrendIndicator current={snapshot.currentPolicyRate} previous={snapshot.previousPolicyRate} />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-gray-900 text-xs font-bold">{formatDateOnly(snapshot.lastRateReleaseAt)}</span>
                        <span className="text-gray-400 text-[9px] uppercase font-black">{formatRelativeAge(snapshot.lastRateReleaseAt)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-blue-600 text-xs font-bold">
                          {snapshot.nextRateEventAt ? formatDateOnly(snapshot.nextRateEventAt) : "Awaiting Schedule"}
                        </span>
                        {snapshot.nextRateEventAt && (
                          <span className="text-gray-400 text-[9px] uppercase font-black">
                            {new Date(snapshot.nextRateEventAt * 1000) > new Date() 
                              ? `in ${formatDistanceToNow(new Date(snapshot.nextRateEventAt * 1000))}` 
                              : "Pending Release"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-lg font-black text-gray-900 tracking-tight leading-none mb-1">
                          {renderValue(snapshot.currentInflationRate)}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">
                            Prev: {renderValue(snapshot.previousInflationRate)}
                          </span>
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">
                            YoY CPI
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                        snapshot.status === 'ok' ? 'bg-green-50 text-green-700 border-green-100' : 
                        snapshot.status === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                        'bg-red-50 text-red-700 border-red-100'
                      }`}>
                        {snapshot.status}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        ) : (
          /* OPTION C: STRATEGIC FOCUS (Clean & Interactive) */
          <motion.div
            key="focus-view"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            {/* Sidebar: Selection Nodes */}
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
                    <FlagIcon countryCode={snapshot.countryCode} className="h-6 w-9 shadow-sm flex-shrink-0" />
                    <div className="text-left">
                      <div className="text-sm font-bold text-gray-900">{snapshot.bankName}</div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{snapshot.currency}</div>
                    </div>
                  </div>
                  {selectedBank === snapshot.currency && <ArrowRight className="h-4 w-4 text-blue-500" />}
                </button>
              ))}
            </div>

            {/* Focus Panel */}
            <div className="lg:col-span-8 h-full">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedBank}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-3xl shadow-sm p-8 h-full"
                >
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <FlagIcon countryCode={currentSnapshot.countryCode} className="h-10 w-15 shadow-md flex-shrink-0" />
                      <div>
                        <h3 className="text-2xl font-black text-gray-900 tracking-tight">{currentSnapshot.bankName}</h3>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Policy Intelligence Node</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                    <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Policy Rate</span>
                      <div className="flex items-baseline gap-3">
                        <span className="text-4xl font-black text-gray-900 leading-none">{renderValue(currentSnapshot.currentPolicyRate)}</span>
                        <span className="text-sm font-bold text-gray-400 italic">from {renderValue(currentSnapshot.previousPolicyRate)}</span>
                      </div>
                      <div className="mt-3 text-[11px] text-gray-500">
                        {renderSourceLabel(currentSnapshot.policyRateSource)}
                        {currentSnapshot.policyRateSourceTitle ? ` - ${currentSnapshot.policyRateSourceTitle}` : ""}
                      </div>
                    </div>
                    <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Inflation YoY</span>
                      <div className="flex items-baseline gap-3">
                        <span className="text-4xl font-black text-gray-900 leading-none">{renderValue(currentSnapshot.currentInflationRate)}</span>
                        <span className="text-sm font-bold text-gray-400 italic">from {renderValue(currentSnapshot.previousInflationRate)}</span>
                      </div>
                      <div className="mt-3 text-[11px] text-gray-500">
                        {renderSourceLabel(currentSnapshot.inflationSource)}
                        {currentSnapshot.inflationSourceTitle ? ` - ${currentSnapshot.inflationSourceTitle}` : ""}
                      </div>
                    </div>
                  </div>

                  <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    Timeline Schedule
                  </h4>

                  <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
                    <div className="relative pl-8">
                      <div className="absolute left-0 top-1.5 h-6 w-6 rounded-full bg-white border-2 border-gray-200 z-10" />
                      <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Last Rate Release</div>
                        <div className="text-sm font-bold text-gray-700">{formatDateOnly(currentSnapshot.lastRateReleaseAt)}</div>
                      </div>
                    </div>
                    <div className="relative pl-8">
                      <div className="absolute left-0 top-1.5 h-6 w-6 rounded-full bg-blue-500 border-2 border-blue-100 z-10 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                      <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                        <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Next Expected Rate Event</div>
                        <div className="text-sm font-bold text-blue-700">
                          {currentSnapshot.nextRateEventAt ? formatDateOnly(currentSnapshot.nextRateEventAt) : "Awaiting Schedule"}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shared Mapping Audit Panel */}
      <div className="backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-2xl overflow-hidden shadow-sm mt-auto">
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50/30">
          <Info className="h-4 w-4 text-blue-500" />
          <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest">Global Mapping Audit</h3>
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
