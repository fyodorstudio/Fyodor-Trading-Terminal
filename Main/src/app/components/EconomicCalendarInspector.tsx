import { type ReactNode } from "react";
import { X } from "lucide-react";
import { FlagIcon } from "@/app/components/FlagIcon";
import {
  buildCautiousSignal,
  buildMarketFocusItems,
  dedupeCalendarItems,
  getEventValueDisplay,
  getImpactLabel,
} from "@/app/lib/calendarDisplay";
import { formatUtcDateTime } from "@/app/lib/format";
import { formatDateTimeForDisplayTimezone, type DisplayTimezoneSelection } from "@/app/lib/timezoneDisplay";
import { getCountryDisplayName } from "@/app/config/currencyConfig";
import type { CalendarEvent, CalendarEventExplainer, ImpactLevel } from "@/app/types";

export function ImpactPill({ level, label }: { level: ImpactLevel; label?: string }) {
  return (
    <span className={`calendar-impact-pill calendar-impact-${level}`}>
      <span className="calendar-impact-dot" aria-hidden="true" />
      <span>{label ?? getImpactLabel(level)}</span>
    </span>
  );
}

function CalendarEventSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="calendar-event-drawer-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function CalendarEventList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="calendar-event-muted">No specific notes available for this event yet.</p>;
  }

  return (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function CalendarValueText({ value, eventTitle }: { value: string; eventTitle: string }) {
  const valueDisplay = getEventValueDisplay(value, eventTitle);
  return <span title={valueDisplay.title}>{valueDisplay.display}</span>;
}

export function CalendarEventInspectorDrawer({
  event,
  explainer,
  timezoneMode,
  onClose,
}: {
  event: CalendarEvent;
  explainer: CalendarEventExplainer;
  timezoneMode: DisplayTimezoneSelection;
  onClose: () => void;
}) {
  const countryName = getCountryDisplayName(event.countryCode);
  const marketFocusItems = buildMarketFocusItems(event, explainer);
  const caveats = dedupeCalendarItems([...explainer.priceCaveats, ...(explainer.commonTraps ?? [])]);
  const workflow = explainer.tradingWorkflow ?? [];
  const comparisons = explainer.whatToCompare ?? [];
  const isPlaceholderExplainer = explainer.knowledgeDepth === "generic";

  return (
    <aside
      className="calendar-event-drawer"
      role="dialog"
      aria-modal="true"
      aria-label={`${event.title} trading brief`}
      onClick={(eventClick) => eventClick.stopPropagation()}
    >
      <header className="calendar-event-drawer-head">
        <div className="calendar-event-drawer-title">
          <span className="calendar-event-drawer-kicker">
            {explainer.familyLabel}
            {explainer.knowledgeDepth ? ` / ${explainer.knowledgeDepth}` : ""}
          </span>
          <h3>{event.title}</h3>
          <div className="calendar-event-drawer-meta">
            <FlagIcon countryCode={event.countryCode} className="h-4 w-6 border border-gray-200 rounded-sm" />
            <span>{countryName}</span>
            <span>{event.currency}</span>
            <ImpactPill level={event.impact} />
          </div>
        </div>
        <button type="button" className="calendar-event-close" aria-label="Close event details" onClick={onClose}>
          <X size={17} />
        </button>
      </header>

      <div className="calendar-event-drawer-body">
        <section className="calendar-event-release-card">
          <div className="calendar-event-release-head">
            <div>
              <span>Release snapshot</span>
              <strong>{explainer.releaseStatus ?? "Context only"}</strong>
            </div>
            <div className={isPlaceholderExplainer ? "calendar-event-depth-pill is-placeholder" : "calendar-event-depth-pill"}>
              {isPlaceholderExplainer ? "Placeholder explainer" : `${explainer.knowledgeDepth ?? "family"} explainer`}
            </div>
          </div>
          {isPlaceholderExplainer ? (
            <p className="calendar-event-placeholder-note">
              This broker event name is not mapped to a specific Fyodor event playbook yet. Treat this as broad macro context, not a specialized explanation.
            </p>
          ) : null}
          <p className="calendar-event-snapshot">{explainer.resultSnapshot ?? "No release result is available yet."}</p>
          <p className="calendar-event-signal">{buildCautiousSignal(explainer)}</p>
          <div className="calendar-event-facts">
            <div>
              <span>Actual</span>
              <strong><CalendarValueText value={event.actual} eventTitle={event.title} /></strong>
            </div>
            <div>
              <span>Forecast</span>
              <strong><CalendarValueText value={event.forecast} eventTitle={event.title} /></strong>
            </div>
            <div>
              <span>Previous</span>
              <strong><CalendarValueText value={event.previous} eventTitle={event.title} /></strong>
            </div>
            <div>
              <span>MT5 UTC</span>
              <strong>{formatUtcDateTime(event.time)}</strong>
            </div>
            <div>
              <span>Viewer Time</span>
              <strong>{formatDateTimeForDisplayTimezone(event.time, timezoneMode)}</strong>
            </div>
          </div>
        </section>

        <div className="calendar-event-two-column">
          <CalendarEventSection title="What this event is">
            <p>{explainer.whatItIs}</p>
          </CalendarEventSection>

          <CalendarEventSection title="Why traders care">
            <p>{explainer.whyTradersCare}</p>
            <p>{explainer.educationalSummary}</p>
          </CalendarEventSection>
        </div>

        <CalendarEventSection title="Affected markets">
          <p className="calendar-event-section-lead">
            Use these as watch targets, not automatic trade directions.
          </p>
          <div className="calendar-event-affects">
            <CalendarEventList items={marketFocusItems} />
          </div>
        </CalendarEventSection>

        <div className="calendar-event-two-column calendar-event-two-column-balanced">
          <CalendarEventSection title="What to compare">
            <CalendarEventList items={comparisons} />
          </CalendarEventSection>

          <CalendarEventSection title="Confirmation workflow">
            <CalendarEventList items={workflow} />
          </CalendarEventSection>
        </div>

        <CalendarEventSection title="Stronger / Weaker Outcome">
          <div className="calendar-outcome-grid">
            <div>
              <span>Stronger-than-expected</span>
              <p>{explainer.strongerOutcome}</p>
            </div>
            <div>
              <span>Weaker-than-expected</span>
              <p>{explainer.weakerOutcome}</p>
            </div>
          </div>
        </CalendarEventSection>

        <CalendarEventSection title="Traps and caveats">
          <CalendarEventList items={caveats} />
        </CalendarEventSection>

        <CalendarEventSection title="Context reminder">
          <p>{explainer.contextNote}</p>
          {explainer.marketSensitivity ? <p>{explainer.marketSensitivity}</p> : null}
        </CalendarEventSection>
      </div>
    </aside>
  );
}
