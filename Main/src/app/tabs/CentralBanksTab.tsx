import { formatDateOnly, formatRelativeAge } from "@/app/lib/format";
import { motion } from "framer-motion";
import { Database, CheckCircle2, AlertTriangle, XCircle, ArrowUpRight, ArrowDownRight, Minus, Info } from "lucide-react";
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
  const okCount = snapshots.filter((item) => item.status === "ok").length;

  return (
    <div className="flex flex-col gap-4 max-w-[1460px] mx-auto pb-12">
      {/* Top Header Section */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-2xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-gray-900 rounded-xl shadow-lg">
            <Database className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">Command Center</h2>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Central Bank Intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl shadow-sm">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Resolution</span>
            <span className="text-sm font-bold text-gray-900">{okCount}/8 <span className="text-gray-400">Nodes</span></span>
          </div>
          <div className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-500">
            Ingest: {formatRelativeAge(lastCalendarIngestAt)}
          </div>
        </div>
      </div>

      {/* The Command Table */}
      <div className="backdrop-blur-xl bg-white/60 border border-gray-200/50 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Institution</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Policy Rate</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Trend</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Inflation (YoY)</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Timeline</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {snapshots.map((snapshot, index) => (
              <motion.tr 
                key={snapshot.currency}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className="hover:bg-white/80 transition-colors group"
              >
                {/* Institution */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="text-xl filter grayscale group-hover:grayscale-0 transition-all">{snapshot.flag}</div>
                    <div>
                      <div className="text-sm font-bold text-gray-900">{snapshot.bankName}</div>
                      <div className="text-[10px] font-bold text-gray-500">{snapshot.currency}</div>
                    </div>
                  </div>
                </td>

                {/* Policy Rate */}
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-lg font-black text-gray-900 tracking-tight">{renderValue(snapshot.currentPolicyRate)}</span>
                    <span className="text-[10px] font-bold text-gray-400">Prev: {renderValue(snapshot.previousPolicyRate)}</span>
                  </div>
                </td>

                {/* Trend */}
                <td className="px-6 py-4">
                  <div className="flex justify-center">
                    <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm">
                      <TrendIndicator current={snapshot.currentPolicyRate} previous={snapshot.previousPolicyRate} />
                    </div>
                  </div>
                </td>

                {/* Inflation */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[60px]">
                      <div 
                        className="h-full bg-blue-500 rounded-full" 
                        style={{ width: `${Math.min(100, (parseFloat(snapshot.currentInflationRate || "0") / 10) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-700">{renderValue(snapshot.currentInflationRate)}</span>
                  </div>
                </td>

                {/* Timeline */}
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                      <span className="w-8">RATE:</span>
                      <span className="text-gray-600">{snapshot.nextRateEventAt ? formatDateOnly(snapshot.nextRateEventAt) : "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                      <span className="w-8">CPI:</span>
                      <span className="text-gray-600">{snapshot.nextCpiEventAt ? formatDateOnly(snapshot.nextCpiEventAt) : "N/A"}</span>
                    </div>
                  </div>
                </td>

                {/* Status */}
                <td className="px-6 py-4 text-right">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                    snapshot.status === 'ok' ? 'bg-green-50 text-green-700 border-green-100' : 
                    snapshot.status === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                    'bg-red-50 text-red-700 border-red-100'
                  }`}>
                    <div className={`h-1.5 w-1.5 rounded-full ${
                      snapshot.status === 'ok' ? 'bg-green-500' : 
                      snapshot.status === 'partial' ? 'bg-amber-500' : 
                      'bg-red-500'
                    }`} />
                    {snapshot.status}
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
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
