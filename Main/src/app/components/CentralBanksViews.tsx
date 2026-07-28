import { ArrowRight, Clock } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { FlagIcon } from "@/app/components/FlagIcon";
import { formatDateOnly } from "@/app/lib/format";
import type { CentralBankSnapshot } from "@/app/types";

function renderValue(value: string | null): string {
  return value && value.trim() !== "" ? value : "N/A";
}

function renderSourceLabel(source: CentralBankSnapshot["policyRateSource"]): string {
  if (source === "released_actual") return "Released actual";
  if (source === "upcoming_previous") return "Upcoming previous";
  return "Unresolved";
}

function renderNextEventDate(timestamp: number | null): string {
  return timestamp ? formatDateOnly(timestamp) : "Not scheduled in MT5";
}

function renderNextEventTitle(title: string | null): string {
  return title && title.trim() !== "" ? title : "No matched future MT5 event";
}

interface CentralBanksCommandViewProps {
  snapshots: CentralBankSnapshot[];
}

export function CentralBanksCommandView({ snapshots }: CentralBanksCommandViewProps) {
  return (
    <motion.div
      key="command-view"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col gap-3"
    >
      {snapshots.map((snapshot, index) => (
        <motion.div
          key={snapshot.currency}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.02 }}
          className="bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-300 transition-all group overflow-hidden"
        >
          <div className="grid items-stretch divide-y divide-gray-100 lg:grid-cols-[minmax(220px,1fr)_minmax(240px,1.4fr)_minmax(240px,1.4fr)_96px] lg:divide-x lg:divide-y-0">
            <div className="min-w-0 p-5 flex items-center gap-4 bg-gray-50/30">
              <div className="relative">
                <FlagIcon countryCode={snapshot.countryCode} className="h-8 w-12 shadow-sm rounded-sm border border-gray-200/50" />
                <div className={`absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-white shadow-sm ${
                  snapshot.status === "ok" ? "bg-green-500" :
                  snapshot.status === "partial" ? "bg-amber-500" : "bg-red-500"
                }`} />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-black text-gray-900 tracking-tight leading-none mb-1">{snapshot.bankName}</div>
                <div className="text-[11px] font-black text-blue-600 uppercase tracking-widest">{snapshot.currency} Protocol</div>
              </div>
            </div>

            <div className="min-w-0 p-5 grid gap-4 bg-white sm:grid-cols-[minmax(0,1fr)_minmax(150px,0.85fr)] sm:items-center">
              <div className="min-w-0">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Policy Rate</div>
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="text-3xl font-black text-gray-900 tracking-tighter">{renderValue(snapshot.currentPolicyRate)}</span>
                  <span className="text-xs font-bold text-gray-500 tabular-nums">Prev: {renderValue(snapshot.previousPolicyRate)}</span>
                </div>
              </div>
              <div className="min-w-0 flex flex-col sm:text-right">
                <div className="flex flex-col mb-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Last Released</span>
                  <span className="text-xs font-black text-gray-900">{formatDateOnly(snapshot.lastRateReleaseAt)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">Next Event</span>
                  <span className="text-xs font-black text-blue-700">
                    {renderNextEventDate(snapshot.nextRateEventAt)}
                  </span>
                  <span className="mt-1 text-[10px] font-medium text-gray-500">{renderNextEventTitle(snapshot.nextRateEventTitle)}</span>
                </div>
              </div>
            </div>

            <div className="min-w-0 p-5 grid gap-4 bg-white sm:grid-cols-[minmax(0,1fr)_minmax(150px,0.85fr)] sm:items-center">
              <div className="min-w-0">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Inflation YoY</div>
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="text-3xl font-black text-gray-900 tracking-tighter">{renderValue(snapshot.currentInflationRate)}</span>
                  <span className="text-xs font-bold text-gray-500 tabular-nums">Prev: {renderValue(snapshot.previousInflationRate)}</span>
                </div>
              </div>
              <div className="min-w-0 flex flex-col sm:text-right">
                <div className="flex flex-col mb-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Last Released</span>
                  <span className="text-xs font-black text-gray-900">{formatDateOnly(snapshot.lastCpiReleaseAt)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">Next Event</span>
                  <span className="text-xs font-black text-blue-700">
                    {renderNextEventDate(snapshot.nextCpiEventAt)}
                  </span>
                  <span className="mt-1 text-[10px] font-medium text-gray-500">{renderNextEventTitle(snapshot.nextCpiEventTitle)}</span>
                </div>
              </div>
            </div>

            <div className="min-w-0 p-5 flex flex-col items-center justify-center bg-gray-50/30 group-hover:bg-blue-50/50 transition-colors">
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Node</div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${
                snapshot.status === "ok" ? "bg-green-50 text-green-700 border-green-200" :
                snapshot.status === "partial" ? "bg-amber-50 text-amber-700 border-amber-200" :
                "bg-red-50 text-red-700 border-red-200"
              }`}>
                {snapshot.status}
              </span>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

interface CentralBanksFocusViewProps {
  snapshots: CentralBankSnapshot[];
  selectedBank: string;
  onSelectedBankChange: (currency: string) => void;
}

export function CentralBanksFocusView({
  snapshots,
  selectedBank,
  onSelectedBankChange,
}: CentralBanksFocusViewProps) {
  const currentSnapshot = snapshots.find((snapshot) => snapshot.currency === selectedBank) || snapshots[0];

  if (!currentSnapshot) {
    return (
      <div className="rounded-3xl border border-dashed border-gray-300 bg-white/60 p-8 text-center text-sm font-semibold text-gray-500">
        No central-bank snapshots are loaded.
      </div>
    );
  }

  return (
    <motion.div
      key="focus-view"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start"
    >
      <div className="lg:col-span-4 flex flex-col gap-2">
        {snapshots.map((snapshot) => (
          <button
            key={snapshot.currency}
            onClick={() => onSelectedBankChange(snapshot.currency)}
            className={`
              flex items-center justify-between p-3 rounded-2xl transition-all duration-300 border
              ${selectedBank === snapshot.currency
                ? "bg-white border-blue-200 shadow-md translate-x-2"
                : "bg-white/40 border-gray-200/50 hover:bg-white/60"}
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

      <div className="lg:col-span-8 h-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedBank}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-3xl shadow-sm p-5 h-full"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-4">
                <FlagIcon countryCode={currentSnapshot.countryCode} className="h-10 w-15 shadow-md flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">{currentSnapshot.bankName}</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Policy Intelligence Node</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-5 bg-white rounded-2xl shadow-sm border border-gray-100">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Policy Rate</span>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-black text-gray-900 leading-none">{renderValue(currentSnapshot.currentPolicyRate)}</span>
                  <span className="text-sm font-bold text-gray-400 italic">from {renderValue(currentSnapshot.previousPolicyRate)}</span>
                </div>
                <div className="mt-3 text-[11px] text-gray-500">
                  {renderSourceLabel(currentSnapshot.policyRateSource)}
                  {currentSnapshot.policyRateSourceTitle ? ` - ${currentSnapshot.policyRateSourceTitle}` : ""}
                </div>
                <div className="mt-4 flex items-center justify-between gap-4 text-[11px]">
                  <div className="flex flex-col">
                    <span className="font-black text-gray-400 uppercase tracking-widest">Last Released</span>
                    <span className="font-bold text-gray-700">{formatDateOnly(currentSnapshot.lastRateReleaseAt)}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="font-black text-blue-400 uppercase tracking-widest">Next Event</span>
                    <span className="font-bold text-blue-700">
                      {renderNextEventDate(currentSnapshot.nextRateEventAt)}
                    </span>
                    <span className="mt-1 text-gray-500">{renderNextEventTitle(currentSnapshot.nextRateEventTitle)}</span>
                  </div>
                </div>
              </div>
              <div className="p-5 bg-white rounded-2xl shadow-sm border border-gray-100">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Inflation YoY</span>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-black text-gray-900 leading-none">{renderValue(currentSnapshot.currentInflationRate)}</span>
                  <span className="text-sm font-bold text-gray-400 italic">from {renderValue(currentSnapshot.previousInflationRate)}</span>
                </div>
                <div className="mt-3 text-[11px] text-gray-500">
                  {renderSourceLabel(currentSnapshot.inflationSource)}
                  {currentSnapshot.inflationSourceTitle ? ` - ${currentSnapshot.inflationSourceTitle}` : ""}
                </div>
                <div className="mt-4 flex items-center justify-between gap-4 text-[11px]">
                  <div className="flex flex-col">
                    <span className="font-black text-gray-400 uppercase tracking-widest">Last Released</span>
                    <span className="font-bold text-gray-700">{formatDateOnly(currentSnapshot.lastCpiReleaseAt)}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="font-black text-blue-400 uppercase tracking-widest">Next Event</span>
                    <span className="font-bold text-blue-700">
                      {renderNextEventDate(currentSnapshot.nextCpiEventAt)}
                    </span>
                    <span className="mt-1 text-gray-500">{renderNextEventTitle(currentSnapshot.nextCpiEventTitle)}</span>
                  </div>
                </div>
              </div>
            </div>

            <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Timeline Schedule
            </h4>

            <div className="space-y-3 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
              <div className="relative pl-8">
                <div className="absolute left-0 top-1.5 h-6 w-6 rounded-full bg-white border-2 border-gray-200 z-10" />
                <div className="p-3 bg-gray-50/50 rounded-2xl border border-gray-100">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Last Rate Release</div>
                  <div className="text-sm font-bold text-gray-700">{formatDateOnly(currentSnapshot.lastRateReleaseAt)}</div>
                </div>
              </div>
              <div className="relative pl-8">
                <div className="absolute left-0 top-1.5 h-6 w-6 rounded-full bg-blue-500 border-2 border-blue-100 z-10 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-100">
                  <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Next Expected Rate Event</div>
                  <div className="text-sm font-bold text-blue-700">
                    {renderNextEventDate(currentSnapshot.nextRateEventAt)}
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500">{renderNextEventTitle(currentSnapshot.nextRateEventTitle)}</div>
                </div>
              </div>
              <div className="relative pl-8">
                <div className="absolute left-0 top-1.5 h-6 w-6 rounded-full bg-white border-2 border-gray-200 z-10" />
                <div className="p-3 bg-gray-50/50 rounded-2xl border border-gray-100">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Last CPI Release</div>
                  <div className="text-sm font-bold text-gray-700">{formatDateOnly(currentSnapshot.lastCpiReleaseAt)}</div>
                </div>
              </div>
              <div className="relative pl-8">
                <div className="absolute left-0 top-1.5 h-6 w-6 rounded-full bg-violet-500 border-2 border-violet-100 z-10 shadow-[0_0_10px_rgba(139,92,246,0.35)]" />
                <div className="p-3 bg-violet-50/60 rounded-2xl border border-violet-100">
                  <div className="text-[10px] font-black text-violet-500 uppercase tracking-widest mb-1">Next Expected CPI Event</div>
                  <div className="text-sm font-bold text-violet-700">
                    {renderNextEventDate(currentSnapshot.nextCpiEventAt)}
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500">{renderNextEventTitle(currentSnapshot.nextCpiEventTitle)}</div>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
