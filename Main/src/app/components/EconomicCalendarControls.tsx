import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";
import {
  formatImpactSummary,
  getCalendarFreshness,
} from "@/app/lib/calendarDisplay";
import type { ImpactLevel } from "@/app/types";

interface HelpHintPosition {
  top: number;
  left: number;
  placement: "above" | "below";
}

function getHelpHintPosition(trigger: HTMLButtonElement): HelpHintPosition {
  const rect = trigger.getBoundingClientRect();
  const tooltipWidth = 280;
  const margin = 12;
  const left = Math.min(
    window.innerWidth - tooltipWidth / 2 - margin,
    Math.max(tooltipWidth / 2 + margin, rect.left + rect.width / 2),
  );
  const nearHeader = rect.top < 120;
  return {
    top: nearHeader ? rect.bottom + 10 : rect.top - 10,
    left,
    placement: nearHeader ? "below" : "above",
  };
}

export function HelpHint({ label, detail }: { label: string; detail: string }) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<HelpHintPosition | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    setPosition(getHelpHintPosition(triggerRef.current));
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      setPosition(getHelpHintPosition(triggerRef.current));
    };

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  return (
    <span className="calendar-help-hint">
      {label}
      <button
        ref={triggerRef}
        type="button"
        className="calendar-help-button"
        aria-label={detail}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <CircleHelp size={12} />
      </button>
      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              className="calendar-help-popover"
              role="tooltip"
              style={{ top: position.top, left: position.left }}
              data-placement={position.placement}
            >
              {detail}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}

export function FreshnessChip({
  label,
  detail,
  freshness,
}: {
  label: string;
  detail: string;
  freshness: ReturnType<typeof getCalendarFreshness>;
}) {
  return (
    <div className={`calendar-freshness-chip calendar-freshness-${freshness.state}`}>
      <span className="calendar-freshness-label">
        <HelpHint label={label} detail={detail} />
      </span>
      <span className="calendar-freshness-value">
        <span className="calendar-freshness-dot" aria-hidden="true" />
        <strong>{freshness.label}</strong>
        <em>{freshness.ageLabel}</em>
      </span>
    </div>
  );
}

export function ImpactSummary({ impacts }: { impacts: ImpactLevel[] }) {
  return (
    <span className="calendar-control-text" aria-label={`Impact: ${formatImpactSummary(impacts)}`}>
      <span>Impact</span>
      <strong>{formatImpactSummary(impacts)}</strong>
    </span>
  );
}

export function CalendarClockCard({
  label,
  value,
  detail,
  icon,
  subValue,
  offline = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon?: ReactNode;
  subValue?: string;
  offline?: boolean;
}) {
  return (
    <span className={offline ? "calendar-clock-card is-offline" : "calendar-clock-card"}>
      {icon ? <span className="calendar-clock-icon">{icon}</span> : null}
      <span className="calendar-control-text">
        <span>
          <HelpHint label={label} detail={detail} />
        </span>
        <strong>{value}</strong>
        {subValue ? <em>{subValue}</em> : null}
      </span>
    </span>
  );
}
