import { X } from "lucide-react";
import { EventTemplateButton } from "@/app/components/EventReplayPanels";
import {
  getEventTemplateMetaLabel,
  type EventTemplateFilter,
  type EventTemplateTiming,
} from "@/app/lib/eventReplayDisplay";
import type { EventTemplate } from "@/app/types";

interface EventReplaySelectEventModalProps {
  pairTemplateCount: number;
  globalTemplateCount: number;
  pairTemplates: EventTemplate[];
  globalTemplates: EventTemplate[];
  recentlyReleasedTemplates: EventTemplate[];
  selectedTemplateKey: string | null;
  filter: EventTemplateFilter;
  templateTiming: Map<string, EventTemplateTiming>;
  countdownNowMs: number;
  onFilterChange: (filter: EventTemplateFilter) => void;
  onSelectTemplate: (key: string) => void;
  onClose: () => void;
}

function TemplateList(props: {
  title: string;
  emptyLabel: string;
  templates: EventTemplate[];
  selectedTemplateKey: string | null;
  templateTiming: Map<string, EventTemplateTiming>;
  countdownNowMs: number;
  metaMode: "upcoming" | "recent";
  onSelectTemplate: (key: string) => void;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="m-0 text-sm font-black text-slate-950">{props.title}</h4>
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
          {props.templates.length} shown
        </span>
      </div>
      <div className="grid gap-2">
        {props.templates.length === 0 ? (
          <div className="border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            {props.emptyLabel}
          </div>
        ) : (
          props.templates.map((template) => (
            <EventTemplateButton
              key={`${template.key}-${props.metaMode}`}
              template={template}
              active={props.selectedTemplateKey === template.key}
              metaLabel={getEventTemplateMetaLabel(
                template,
                props.metaMode,
                props.templateTiming,
                props.countdownNowMs,
              )}
              onSelect={() => props.onSelectTemplate(template.key)}
            />
          ))
        )}
      </div>
    </section>
  );
}

export function EventReplaySelectEventModal({
  pairTemplateCount,
  globalTemplateCount,
  pairTemplates,
  globalTemplates,
  recentlyReleasedTemplates,
  selectedTemplateKey,
  filter,
  templateTiming,
  countdownNowMs,
  onFilterChange,
  onSelectTemplate,
  onClose,
}: EventReplaySelectEventModalProps) {
  return (
    <div
      className="event-replay-modal-overlay fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/25 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Select Event"
    >
      <aside
        className="event-replay-modal-panel flex w-full max-w-[1180px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="m-0 text-lg font-black text-slate-950">Select Event</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                {pairTemplateCount} pair events / {globalTemplateCount} global movers
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600"
              onClick={onClose}
              aria-label="Close event selector"
            >
              <X size={16} />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
              <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-blue-500">
                Primary discovery
              </span>
              <strong className="mt-1 block text-sm font-black text-slate-950">
                Upcoming next includes countdown
              </strong>
              <span className="mt-1 block text-xs font-semibold leading-5 text-slate-600">
                Scheduled event types are prioritized only when they already have replay history.
              </span>
            </div>
            <label className="grid min-w-[190px] gap-1">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Quality filter</span>
              <select
                value={filter}
                onChange={(event) => onFilterChange(event.target.value as EventTemplateFilter)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black capitalize text-slate-800 outline-none"
              >
                {(["all", "usable", "limited", "weak"] as EventTemplateFilter[]).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
            <div className="grid gap-5 lg:grid-cols-2">
              <TemplateList
                title="Upcoming Base/Quote Events"
                emptyLabel="No pair events match this filter."
                templates={pairTemplates}
                selectedTemplateKey={selectedTemplateKey}
                templateTiming={templateTiming}
                countdownNowMs={countdownNowMs}
                metaMode="upcoming"
                onSelectTemplate={onSelectTemplate}
              />

              <div className="min-w-0 border-t border-slate-200 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                <TemplateList
                  title="Upcoming Global Movers"
                  emptyLabel="No global movers match this filter."
                  templates={globalTemplates}
                  selectedTemplateKey={selectedTemplateKey}
                  templateTiming={templateTiming}
                  countdownNowMs={countdownNowMs}
                  metaMode="upcoming"
                  onSelectTemplate={onSelectTemplate}
                />
              </div>
            </div>

            <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h4 className="m-0 text-sm font-black text-slate-950">Recently Released</h4>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Fresh historical replay templates.</p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  {recentlyReleasedTemplates.length}
                </span>
              </div>
              <div className="grid gap-2">
                {recentlyReleasedTemplates.map((template) => (
                  <EventTemplateButton
                    key={`${template.key}-recent`}
                    template={template}
                    active={selectedTemplateKey === template.key}
                    metaLabel={getEventTemplateMetaLabel(template, "recent", templateTiming, countdownNowMs)}
                    onSelect={() => onSelectTemplate(template.key)}
                  />
                ))}
              </div>
            </section>
          </div>
        </div>
      </aside>
    </div>
  );
}
