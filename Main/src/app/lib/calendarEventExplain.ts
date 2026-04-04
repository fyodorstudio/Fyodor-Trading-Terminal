import {
  CALENDAR_EVENT_FAMILY_DEFAULTS,
  CALENDAR_EVENT_GENERIC_FALLBACK,
  CALENDAR_EVENT_TITLE_OVERRIDES,
} from "@/app/lib/calendarEventKnowledge";
import { classifyEventQualityFamily } from "@/app/lib/eventQuality";
import type { CalendarEvent, CalendarEventExplainer } from "@/app/types";

function normalizeEventTitle(title: string): string {
  return title.trim().toLowerCase();
}

export function getCalendarEventExplainer(event: CalendarEvent): CalendarEventExplainer {
  const normalizedTitle = normalizeEventTitle(event.title);
  const directOverride = CALENDAR_EVENT_TITLE_OVERRIDES[normalizedTitle];
  if (directOverride) {
    const family = classifyEventQualityFamily(event.title);
    return {
      family: family?.family ?? "generic",
      familyLabel: directOverride.familyLabel,
      ...directOverride,
    };
  }

  const family = classifyEventQualityFamily(event.title);
  if (!family) {
    return CALENDAR_EVENT_GENERIC_FALLBACK;
  }

  const familyDefault = CALENDAR_EVENT_FAMILY_DEFAULTS[family.family];
  return {
    family: family.family,
    familyLabel: family.label,
    ...familyDefault,
  };
}
