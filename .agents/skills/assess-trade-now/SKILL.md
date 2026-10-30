---
name: assess-trade-now
description: Research current forex and selective commodity fundamentals, compare supported opportunities, and save dated currency developments and assessments in Thesis. Fundamental-first; no trading or background monitoring.
---

# Assess Trade Now

The user's workflow is broad fundamental research alongside their own technical
analysis and manual price alerts. A bare invocation researches USD, EUR, GBP, JPY,
CHF, CAD, AUD and NZD for the current session, with selective BRENT/WTI/GOLD discovery.
A named currency/pair, research period or narrower request overrides that default.
A supplied chart does not require candles; fetch prices/technical levels only on
an explicit price-aware request. No trades, broker changes or automatic monitoring.

The requested product is a potential-impact verdict: **event/development → currency
potentially strengthens or weakens → Strong/Moderate/Slight → causal reason**.
Research and give that verdict without requiring proof of realised FX demand,
certainty, live pricing or an execution-ready trade. State material opposition
briefly. Ordinary uncertainty and conflicting mechanisms are part of assessment,
not reasons to return the work to the user as "Review needed". Use the shared
scale to distinguish same-direction currencies, not just label each in isolation.

The user primarily watches the left **Fundamentals** panel. A bare live invocation
authorizes research and saving to Thesis, including refreshing **Evidence age | CUR |
VERDICT | Checkpoint**, without a separate save/panel request or screenshots.
Chat and bottom-Thesis detail alone are insufficient. The panel projects the Thesis
ledger; never author a second verdict store. Read
`pnpm analyst thesis summary --scope ALL` before researching and verify the affected
rows through the [left-panel audit](references/thesis-research.md#left-panel-freshness-audit)
after saving. Read-only/no-save instructions still win.

## Research procedure

1. Read the clock and establish requested currencies, research period and decision
   horizon. Default to the current session and intervening news since the saved
   assessment. A seven-day event scan is not a seven-day directional forecast.
2. Read the saved Thesis interval and relevant current summary. Use
   [Thesis research](references/thesis-research.md) for saves and interval updates.
   Identify missing periods and unresolved material developments. Saved conclusions
   are dated context; do not assume they remain true. For repeat assessments use
   [efficient refreshes](references/thesis-research.md#efficient-refreshes): check
   what changed for every requested currency, then investigate material changes
   and gaps deeply instead of rebuilding unchanged foundations.
   Load the affected currency's active policy/inflation/labour foundations, even
   when they predate the visible day. Saved history is context, not proof that the
   decisive sources or policy priorities were researched. Use the
   [causal weighting](references/fundamental-assessment.md#causal-weighting) check.
3. Check the preceding hour, next six hours and overnight policy/media stages first.
   Then research the requested period broadly across policy/path, inflation,
   labour/wages, activity and material fiscal, trade, funding, commodity, haven and
   geopolitical channels. Check relevant upcoming stages over at least seven days.
   USD includes Treasury auctions, buyback announcements/windows/results and relevant
   Fed/NYFed operations. Official schedules, actuals and dated reporting outrank a
   flawed or empty broker calendar. Open decisive bodies and seek contrary evidence.
   Check the uncovered interval with a neutral chronological news sweep, including
   counterpart guidance and later conference updates. Follow material leads to
   their source bodies; search results and repeated syndications are discovery,
   not completed coverage. Fresh news challenges saved views; never filter
   discovery through the old verdict.
   Include the brief [opportunity sweep](references/opportunity-discovery.md), with
   exceptional clearly supported candidates outside FX unless explicitly excluded.
4. Distinguish attributed expectations from actuals and subsequent guidance. Explain
   the dominant surprise or continuing mechanism, material offsets and beneficiaries.
   One release package is not several independent votes. An expected hike/hold/cut
   alone is not a direction. Never invent investor flows, probabilities or returns.
   Complete the [decision check](references/fundamental-assessment.md#decision-check-before-saving)
   in the assessment reason before upgrading, retaining or reversing a verdict.
   Apply the [release and retention check](references/fundamental-assessment.md#release-and-retention-check):
   distinguish the policy backdrop, incremental release effect and pressure over
   the chosen horizon. Rejustify the direction against new contrary evidence;
   lowering intensity alone does not establish that the old direction survives.
   State the event's potential impact separately when the overall backdrop differs.
   Explain why this event changes, reinforces or merely offsets the leading
   mechanism; a secondary release does not automatically reverse the currency view.
   Compare same-direction currencies over an overlapping horizon before completing
   a broad assessment or requested cross review; explain the stronger mechanism.
5. Give the supported current decision promptly once the decisive facts are checked.
   Do not delay an imminent release verdict for bookkeeping or unrelated currencies.
   A focused release updates affected mechanisms; it does not require a full eight-
   currency investigation. Give supported potential impacts even when part of the
   package remains unavailable; identify the exact unverified claim separately.
   Conflicting known evidence, absent live OIS or lack of certainty are not missing
   facts. Check exceptional contrary news before carrying a view.
   Label a first-stage call **Provisional** when a material guidance stage remains
   unresolved. Resolve available later guidance/Q&A within the active scope/bound;
   a completed statement retrieval is not a completed conference review. An
   overdue checkpoint-only audit preserves the earlier assessment clock and
   records the specific unresolved stage instead of freshly endorsing the call.
6. Save findings once and assessments separately when authorized. Requested Thesis
   research authorizes its save; live assessments/release invocations have standing
   permission to refresh an existing live summary. Record original publication/event
   times, verification clocks, currency implications and effects on the prior thesis.
   Reuse stable development keys; keep old active evidence as background. No item
   quota, mandatory entry payload or daily copying. Read-only/chat-only/no-save wins.
   New directions explicitly declare `review_status` and `stage_note` under the
   Thesis contract; a save validator cannot determine whether the financial
   interpretation or source coverage is sound.
7. Read back the saved interval and verify the left Fundamentals panel's summary
   contract, affected verdicts, original evidence/assessment clocks and checkpoints.
   A successful ledger save alone does not prove that the panel can load its data.
   Report the decision, material change,
   next checkpoint and actual coverage gaps. Preserve all histories and user notes.
   A new save/assessment timestamp must not make old evidence look new.

## Choose the relevant detail

- Currency/pair bias: [fundamental assessment](references/fundamental-assessment.md).
- Broad or dated Thesis research: [research workflow](references/thesis-research.md)
  and [storage/UI contract](../../../docs/THESIS.md). The normal save command is
  `pnpm analyst thesis research-append --scope ALL --input <file>`.
- All live currency judgments use [standalone pressure](references/standalone-fundamentals.md):
  comparable Strong/Moderate/Slight strengthening or weakening, horizon and offsets.
- Requested entry/cross comparisons: [entry decisions](references/entry-decisions.md).
  Opportunities are optional; technical execution remains with the user.
- Early opportunity discovery/explicit price feedback:
  [opportunity discovery](references/opportunity-discovery.md).
- Holding risk, significant reminders or upcoming shortlist:
  [alert review](references/alert-review.md). No second skill invocation is needed.
- Material commodities: [commodity evidence](references/commodities.md); USD
  context alone does not establish oil/gold direction. Preserve instrument identity.
- An explicit release countdown: [One Minute Before Release](../one-minute-before-release/SKILL.md).
- Historical price moves: [Review Historical Research](../review-historical-research/SKILL.md).
  Reconstructions never replace the live summary.

## Sources and persistence

Use direct official releases for facts and schedules, dated credible reporting and
identified futures/OIS pricing for contemporaneous expectations. Keep provider,
definition and capture-time differences separate; preserve raw observations.
Unknown publication hours remain unknown. A source failure is not proof of no news.

dpa-AFX is optional; Dow Jones Newswires is supplementary, including checkpoint
discovery. Verify material schedules independently of newswire access and alarm
state. Access to Reuters, Trading Economics or Mace News does not establish that
every significant development has been discovered or its decisive body opened.

Batch independent checks and reuse shared source bodies across currencies, while
weighing each currency's transmission separately. Prefer known direct release
routes. After a failed retrieval, normally try one suitable alternative and record
the exact gap; further work needs a distinct unresolved material question, not
repeated searches for the same unavailable item. A prepared release wait keeps
its own bounded publication checks. Open decisive bodies and verify their period;
a cached prior release or a new retrieval clock cannot establish fresh actuals.

Read focused calendar/external identities and limitations when relevant; follow
pagination. The optional [discovery helper](references/discovery.md) captures local
indexes and source-open evidence with retrieval clocks. Use it when an auditable
coverage record is useful; manual receipt completion is not a gate for a Thesis save
or supported first verdict. It does not prove exhaustive news discovery.

Saving findings to Thesis does not require pinning every finding. When a calendar
marker, Alert event or significant reminder is useful, reuse exact broker/value IDs
or a stable External Source key. This skill has standing permission to pin/restore
verified relevant occurrences and request dated chart icons, plus a few significant
future Invoke reminders. Follow [External Sources](../../../docs/EXTERNAL-SOURCES.md)
and [alarm selection](references/alert-review.md#significant-checkpoint-reminders).
External mutations use guarded CLI preflight; read back the active identity/time/icon.
Preserve explicit off choices, global pause and offset. Pins/checkpoints alone do
not arm bells. Full Highlight journals and AI impact labels require their own request.
No recurring monitor or automatic AI invocation follows.

## Output format

Lead with a material imminent/just-elapsed stage and the dated current decision:
BUY/SELL for a researched pair, or standalone pressure for a currency. State horizon,
dominant mechanism, strongest opposition, concrete invalidation and next checkpoint.
For event questions, the core answer can be one sentence: "[Verified development]
potentially gives [currency] [Strong/Moderate/Slight strengthening/weakening]
pressure because [channel]." Expand only for material qualifications/comparisons.
For a comparable prior judgment say retained, strengthened, weakened or reversed;
a change of comparison basis is a new baseline, not a guessed market reversal.

Surface supported **LOOK HERE NEXT** candidates when relevant, then chronological
**NEAR-TERM & UPCOMING EVENTS**. A compact dated backdrop is optional when it helps;
detailed findings belong in Thesis. Do not force a large chat table, 28-pair scan,
entry window or certainty claim. Say what was actually checked and what remains
unresolved. On closed markets distinguish next-session preparation from an entry now.
