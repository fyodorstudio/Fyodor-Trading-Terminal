# Fed decision context v2

`assessment/fed-score.ts` retains the factual numerical rate-action interpreter:
hike supports USD, cut weighs on USD with Weak action-only evidence; hold has no
action direction. `ui/FedDecisionContext.tsx` gives actual FOMC decisions a
prominent shared economic-context bias even when the rate is unchanged. Speeches
remain outside scoring.

The shared publication hook runs the existing background context worker. It uses
independent Raycaster filters and current component settings, with each release
admitted only at its own publication time. Rate decisions add no context votes,
renewals or memory resets. No guidance is inferred from a calendar event name.

`runtime/usePreviousFedMeeting.ts` fetches numeric decisions for the preceding
370 days. The latest unique usable earlier decision anchors a context comparison
under the same configured rules. Missing, ambiguous or inconsistent chart clocks
leave that comparison unavailable rather than selecting an older meeting.

`assessment/fed-context.ts` explains economic policy pressure from the existing
inflation/labor contributions and interaction policy. It does not infer observed
Fed intent, quantify surprises or predict the speech/price reaction. Official text
integration is outside this pass. The main result must equal Raycaster at the
same exact publication cutoff. The wrapper owns its one context table, avoiding
a second generic context panel.

Verification: `tests/inspector/expanded/test_expanded_integration.mjs` covers
holds with contextual bias, prior/future/ambiguous meetings, all-off filters,
publication gating and no duplicated table or numeric Fed vote.
