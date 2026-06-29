import {
  CALENDAR_EVENT_FAMILY_DEFAULTS,
  CALENDAR_EVENT_GENERIC_FALLBACK,
  CALENDAR_EVENT_TITLE_OVERRIDES,
} from "@/app/lib/calendarEventKnowledge";
import { findCalendarEventDefinition, type EventResultDirection } from "@/app/lib/calendarEventDefinitions";
import { classifyEventQualityFamily } from "@/app/lib/eventQuality";
import { parseNumericValue } from "@/app/lib/format";
import type { CalendarEvent, CalendarEventExplainer } from "@/app/types";

function normalizeEventTitle(title: string): string {
  return title.trim().toLowerCase();
}

function hasValue(value: string): boolean {
  return value.trim() !== "";
}

function compareLabel(left: number, right: number): "above" | "below" | "in line with" {
  const diff = left - right;
  if (Math.abs(diff) < 1e-9) return "in line with";
  return diff > 0 ? "above" : "below";
}

function inferResultDirection(event: CalendarEvent, explainer: CalendarEventExplainer): EventResultDirection {
  const title = normalizeEventTitle(event.title);
  if (title.includes("unemployment") || title.includes("claimant") || title.includes("jobless claims")) {
    return "lower_supports_currency";
  }
  if (explainer.family === "inflation" || explainer.family === "policy") {
    return "contextual";
  }
  return "higher_supports_currency";
}

function describeResult(
  event: CalendarEvent,
  direction: EventResultDirection,
): Pick<CalendarEventExplainer, "releaseStatus" | "resultSnapshot" | "resultInterpretation"> {
  const actual = parseNumericValue(event.actual);
  const forecast = parseNumericValue(event.forecast);
  const previous = parseNumericValue(event.previous);

  if (!hasValue(event.actual)) {
    const forecastVsPrevious =
      forecast != null && previous != null
        ? ` Forecast is ${compareLabel(forecast, previous)} the previous reading.`
        : "";
    return {
      releaseStatus: "Upcoming / no actual yet",
      resultSnapshot: `No actual value has been released yet.${forecastVsPrevious}`,
      resultInterpretation:
        "Treat this as scheduled event risk. The useful trading question is whether the eventual surprise confirms or invalidates the current pair thesis.",
    };
  }

  if (actual == null) {
    return {
      releaseStatus: "Released / non-numeric actual",
      resultSnapshot: `Actual is posted as ${event.actual}, but the app cannot convert it into a clean numeric surprise.`,
      resultInterpretation:
        "Use the event definition and the first price reaction instead of forcing a numeric beat or miss classification.",
    };
  }

  if (forecast == null) {
    const previousText = previous != null ? ` Actual is ${compareLabel(actual, previous)} the previous reading.` : "";
    return {
      releaseStatus: "Released / no numeric forecast",
      resultSnapshot: `Actual is ${event.actual}.${previousText}`,
      resultInterpretation:
        "There is no clean numeric consensus in the feed, so the reaction should be judged against previous value, broader context, and price acceptance.",
    };
  }

  const actualVsForecast = compareLabel(actual, forecast);
  const previousText = previous != null ? ` It is ${compareLabel(actual, previous)} the previous reading.` : "";
  const surpriseText = `Actual printed ${actualVsForecast} forecast.${previousText}`;

  if (direction === "higher_supports_currency") {
    return {
      releaseStatus: "Released / numeric surprise",
      resultSnapshot: surpriseText,
      resultInterpretation:
        actualVsForecast === "above"
          ? "For this event type, that is normally currency-supportive if the market treats it as stronger growth, demand, or policy pressure."
          : actualVsForecast === "below"
            ? "For this event type, that is normally currency-negative if the market treats it as weaker growth, demand, or policy pressure."
            : "The print matched consensus, so price reaction matters more than the headline value.",
    };
  }

  if (direction === "lower_supports_currency") {
    return {
      releaseStatus: "Released / numeric surprise",
      resultSnapshot: surpriseText,
      resultInterpretation:
        actualVsForecast === "below"
          ? "For this event type, a lower reading is normally currency-supportive because it points to less labor-market stress or less negative pressure."
          : actualVsForecast === "above"
            ? "For this event type, a higher reading is normally currency-negative because it points to more slack, claims, or stress."
            : "The print matched consensus, so price reaction matters more than the headline value.",
    };
  }

  return {
    releaseStatus: "Released / contextual surprise",
    resultSnapshot: surpriseText,
    resultInterpretation:
      "This surprise is not automatically bullish or bearish. Read it through the current regime: inflation fear, growth stress, policy pricing, and whether price confirms the first interpretation.",
  };
}

function completeExplainer(
  event: CalendarEvent,
  explainer: CalendarEventExplainer,
  direction?: EventResultDirection,
): CalendarEventExplainer {
  const result = describeResult(event, direction ?? inferResultDirection(event, explainer));

  return {
    ...explainer,
    knowledgeDepth: explainer.knowledgeDepth ?? "family",
    marketSensitivity:
      explainer.marketSensitivity ??
      "Context-dependent. This event matters most when it changes growth, inflation, policy, or currency-flow expectations.",
    releaseStatus: result.releaseStatus,
    resultSnapshot: result.resultSnapshot,
    resultInterpretation: result.resultInterpretation,
    whatToCompare:
      explainer.whatToCompare ??
      ["Actual versus forecast", "Actual versus previous", "Whether the affected currency moves broadly", "Whether price holds the first reaction"],
    tradingWorkflow:
      explainer.tradingWorkflow ??
      [
        "Before release: decide whether the event is important enough to affect the pair you care about.",
        "At release: classify the surprise without ignoring the broader event family.",
        "After release: require candle follow-through before treating the event as accepted by the market.",
      ],
    commonTraps:
      explainer.commonTraps ??
      ["Treating the headline as the whole story", "Ignoring market expectations", "Forcing a trade when price does not confirm the event read"],
  };
}

export function getCalendarEventExplainer(event: CalendarEvent): CalendarEventExplainer {
  const definition = findCalendarEventDefinition(event.title);
  if (definition) {
    const { resultDirection, ...explainer } = definition;
    return completeExplainer(event, explainer, resultDirection);
  }

  const normalizedTitle = normalizeEventTitle(event.title);
  const directOverride = CALENDAR_EVENT_TITLE_OVERRIDES[normalizedTitle];
  if (directOverride) {
    const family = classifyEventQualityFamily(event.title);
    return completeExplainer(event, {
      ...directOverride,
      family: family?.family ?? "generic",
      familyLabel: directOverride.familyLabel,
      knowledgeDepth: "specific",
    });
  }

  const family = classifyEventQualityFamily(event.title);
  if (!family) {
    return completeExplainer(event, { ...CALENDAR_EVENT_GENERIC_FALLBACK, knowledgeDepth: "generic" });
  }

  const familyDefault = CALENDAR_EVENT_FAMILY_DEFAULTS[family.family];
  return completeExplainer(event, {
    ...familyDefault,
    family: family.family,
    familyLabel: family.label,
    knowledgeDepth: "family",
  });
}
