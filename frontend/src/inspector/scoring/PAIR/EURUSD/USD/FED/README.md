# Fed decision context v2

`assessment/fed-score.ts` retains the factual numerical rate-action interpreter:
hike supports USD, cut weighs on USD with Weak action-only evidence; hold has no
action direction. `ui/FedDecisionContext.tsx` gives actual FOMC decisions a
shared economic-context bias in Raycaster **Context-detailed → At publication**
even when the rate is unchanged. Inspector’s **Standalone Scoring** section
uses `ui/FedRateAction.tsx` for numerical action and supplied-prior checks, with
optional rate history. A hold shows one explanation and the Actual/Previous/Change
table; its underlying direction remains Uncomputed. Speeches
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
a second generic context panel. Optional relative EUR/USD context stays within
the same publication section in Raycaster. Both modes retain their shared preferences.

Verification: `tests/inspector/expanded/test_expanded_integration.mjs` covers
holds with contextual bias, prior/future/ambiguous meetings, all-off filters,
publication gating and no duplicated table or numeric Fed vote.
`tests/inspector/test_publication_layout.mjs` also checks correct column ownership,
separate rate action, relative mode and table wrapping regardless of CSS load order.
