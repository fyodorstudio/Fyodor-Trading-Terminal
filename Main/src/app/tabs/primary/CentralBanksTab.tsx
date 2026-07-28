import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  Database,
  Info,
  List,
  Target,
} from "lucide-react";
import { CentralBanksCommandView, CentralBanksFocusView } from "@/app/components/CentralBanksViews";
import type { BridgeStatus, CentralBankSnapshot } from "@/app/types";

interface CentralBanksTabProps {
  snapshots: CentralBankSnapshot[];
  logs: string[];
  status: BridgeStatus;
  lastCalendarIngestAt: number | null;
}

type ViewMode = "command" | "focus";

export function CentralBanksTab({
  snapshots,
  logs,
}: CentralBanksTabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("focus");
  const [selectedBank, setSelectedBank] = useState<string>(snapshots[0]?.currency || "");
  const [auditOpen, setAuditOpen] = useState(false);

  const okCount = snapshots.filter((item) => item.status === "ok").length;

  return (
    <div className="workspace-page flex h-[calc(100vh-98px)] min-h-[560px] flex-col gap-3 overflow-hidden">
      <div className="relative z-50 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200/50 bg-white/60 p-3 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-gray-900 p-2.5 shadow-lg">
            <Database className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight text-gray-900">Central Bank Intelligence</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Global Policy Monitoring</p>
          </div>
        </div>

        <div className="flex gap-1 rounded-xl border border-gray-200/30 bg-gray-100 p-1.5">
          <button
            onClick={() => setViewMode("command")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              viewMode === "command"
                ? "bg-white text-gray-900 shadow-md"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Detailed Command
          </button>
          <button
            onClick={() => setViewMode("focus")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              viewMode === "focus"
                ? "bg-white text-gray-900 shadow-md"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <Target className="h-3.5 w-3.5" />
            Strategic Focus
          </button>
        </div>

        <div className="hidden items-center gap-3 sm:flex">
          <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-4 py-2 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-tighter text-gray-400">Resolution</span>
            <span className="text-sm font-bold text-gray-900">
              {okCount}/8 <span className="text-xs text-gray-400">Nodes</span>
            </span>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <AnimatePresence mode="wait">
          {viewMode === "command" ? (
            <CentralBanksCommandView snapshots={snapshots} />
          ) : (
            <CentralBanksFocusView
              snapshots={snapshots}
              selectedBank={selectedBank}
              onSelectedBankChange={setSelectedBank}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="mt-auto overflow-hidden rounded-2xl border border-gray-200/50 bg-white/60 shadow-sm backdrop-blur-xl">
        <div className={`flex items-center justify-between gap-3 bg-gray-50/30 px-5 py-3 ${auditOpen ? "border-b border-gray-100" : ""}`}>
          <div className="flex items-center gap-3">
            <Info className="h-4 w-4 text-blue-500" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600">Terminal Console</h3>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-gray-500">
              {logs.length} notes
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAuditOpen((current) => !current)}
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 transition-colors hover:text-gray-900"
          >
            {auditOpen ? "Hide" : "Show"}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${auditOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
        {auditOpen && (
          <div className="max-h-32 overflow-auto bg-gray-50/50 p-4 font-mono text-[10px] text-gray-500">
            {logs.length === 0 ? (
              <div className="flex items-center gap-2 font-bold italic text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                All bridge nodes resolved.
              </div>
            ) : (
              logs.map((line, index) => <div key={index} className="mb-1">{line}</div>)
            )}
          </div>
        )}
      </div>
    </div>
  );
}
