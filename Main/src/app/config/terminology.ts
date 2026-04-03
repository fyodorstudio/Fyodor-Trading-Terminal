import type { BridgeStatus, MarketSessionState } from "@/app/types";
import type { TrustVerdict } from "@/app/lib/status";

export const TERMINOLOGY = {
  trustState: {
    sectionLabel: "Trust State",
    questionLabel: "Can I trust the app right now?",
    shortQuestionLabel: "Trust State",
    states: {
      yes: {
        short: "Yes",
        medium: "Trusted",
        detail: "Core systems are reliable enough for normal use.",
      },
      limited: {
        short: "Limited",
        medium: "Limited",
        detail: "Some important inputs are delayed, partial, or unresolved.",
      },
      no: {
        short: "No",
        medium: "Do Not Trust Yet",
        detail: "Current app state is not reliable enough for real use.",
      },
    } satisfies Record<
      TrustVerdict,
      {
        short: string;
        medium: string;
        detail: string;
      }
    >,
  },

  calendarTiming: {
    sectionLabel: "Calendar Timing",
    shortLabel: "Calendar",
    states: {
      live: {
        short: "Live",
        medium: "Live",
        detail: "Calendar timing is current.",
      },
      stale: {
        short: "Delayed",
        medium: "Delayed",
        detail: "Calendar timing is available but no longer fully fresh.",
      },
      loading: {
        short: "Syncing",
        medium: "Syncing",
        detail: "Calendar timing is still being refreshed.",
      },
      no_data: {
        short: "Unavailable",
        medium: "Unavailable",
        detail: "No usable calendar timing is currently available.",
      },
      error: {
        short: "Unavailable",
        medium: "Unavailable",
        detail: "Calendar timing could not be verified.",
      },
    } satisfies Record<
      BridgeStatus,
      {
        short: string;
        medium: string;
        detail: string;
      }
    >,
  },

  symbolContext: {
    sectionLabel: "Symbol Context",
    shortLabel: "Context",
    states: {
      open: {
        short: "Open",
        medium: "Open",
        detail: "The selected symbol session is open.",
      },
      closed: {
        short: "Closed",
        medium: "Closed",
        detail: "The selected symbol session is closed.",
      },
      unavailable: {
        short: "Unresolved",
        medium: "Unresolved",
        detail: "The selected symbol session state is not fully resolved yet.",
      },
      missing: {
        short: "Unavailable",
        medium: "Unavailable",
        detail: "Selected symbol context is unavailable.",
      },
    } satisfies Record<
      MarketSessionState | "missing",
      {
        short: string;
        medium: string;
        detail: string;
      }
    >,
  },

  macroCoverage: {
    sectionLabel: "Macro Coverage",
    shortLabel: "Coverage",
    states: {
      resolved: {
        short: "Resolved",
        medium: "Resolved",
        detail: "Macro coverage is fully resolved for the tracked set.",
      },
      partial: {
        short: "Partial",
        medium: "Partial",
        detail: "Some macro coverage is resolved, but not all of it.",
      },
      missing: {
        short: "Missing",
        medium: "Missing",
        detail: "Macro coverage is missing for one or more required inputs.",
      },
    },
  },

  macroBackdrop: {
    sectionLabel: "Macro Backdrop",
    questionLabel: "Macro Backdrop Verdict",
    states: {
      supportive: {
        short: "Supportive",
        detail: "The macro backdrop aligns in a supportive direction.",
      },
      hostile: {
        short: "Hostile",
        detail: "The macro backdrop conflicts with the current case.",
      },
      unclear: {
        short: "Unclear",
        detail: "The macro backdrop is mixed or incomplete.",
      },
    },
  },

  pairAttention: {
    sectionLabel: "Pair Attention",
    questionLabel: "Is this pair worth attention right now?",
    states: {
      study_now: {
        short: "Study now",
        detail: "The pair is worth focused attention right now.",
      },
      monitor_later: {
        short: "Monitor later",
        detail: "The pair is worth watching, but not urgent yet.",
      },
      ignore_for_now: {
        short: "Ignore for now",
        detail: "The pair does not currently deserve priority.",
      },
      wait_for_data: {
        short: "Wait for data",
        detail: "The current data quality is not strong enough yet.",
      },
      wait_until_event_passes: {
        short: "Wait until event passes",
        detail: "A nearby event is too close for a clean timing window.",
      },
    },
  },

  eventSensitivity: {
    sectionLabel: "Event Sensitivity",
    shortLabel: "Event Risk",
    states: {
      clear: {
        short: "Clear",
        detail: "No immediate event timing issue is active.",
      },
      event_sensitive: {
        short: "Event-sensitive",
        detail: "Upcoming events are close enough to matter.",
      },
      high_risk_soon: {
        short: "High-risk soon",
        detail: "A relevant high-impact event is too close for a clean setup.",
      },
    },
  },

  pipeline: {
    sectionLabel: "Overview Confidence",
    legacySectionLabel: "Differential Pipeline Status",
    questionLabel: "How complete is the current Overview picture?",
    states: {
      healthy: {
        short: "Pipeline healthy",
        detail: "Overview confidence is fully aligned.",
      },
      limited: {
        short: "Pipeline limited",
        detail: "Overview confidence is usable but partially constrained.",
      },
      degraded: {
        short: "Pipeline degraded",
        detail: "Overview confidence is not strong enough for normal use.",
      },
    },
  },

  actions: {
    sectionLabel: "Action Plan",
    alternateSectionLabel: "Next Steps",
    executeLabel: "Execute",
  },

  labels: {
    bridge: "Bridge",
    marketSession: "Market Session",
    selectedSymbolContext: "Symbol Context",
    resolvedBanks: "Resolved Banks",
    resolvedMacroCoverage: "Resolved Macro Coverage",
    lastIngest: "Last Ingest",
    volatility: "Volatility",
  },
} as const;

export type Terminology = typeof TERMINOLOGY;
