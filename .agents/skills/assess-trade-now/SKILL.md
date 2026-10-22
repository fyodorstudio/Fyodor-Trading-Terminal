---
name: assess-trade-now
description: "Assess forex fundamentals, discover emerging currency opportunities and near-term news, pin verified events, review holding risks, prepare releases or fill a dated Thesis news table. Web-first with optional user-requested price feedback; no background monitoring."
---

# Assess Trade Now

Near-term news discovery is the first priority. A polished backdrop does not make
an assessment complete when an imminent release, Treasury operation or policy
stage was never checked. The user need not invoke a second alert-review skill.
This skill owns assessment, upcoming shortlist and holding/reassessment modes.
Real capital may depend on this research. Treat a missed material catalyst,
unsupported causal claim, stale verdict or false all-clear as a substantive
analyst failure. Research like an expert: find the dominant mechanism, look for
new beneficiaries and opposing evidence, and communicate the supported decision
in time to be useful. Strong language must follow the evidence.

Infer scope and horizon; default an ordinary pair/currency assessment to intraday.
For reversal, recovery and continuation questions, give immediate-session and
next 1–5 trading-session views, unless the user specifies a narrower horizon.
Explain differences in mechanism between horizons; the seven-day event scan is
not a seven-day directional forecast. Keep all
dates/times in Asia/Jakarta AM/PM, UTC internally. Preserve the prompt cutoff:
read the clock immediately (first-observed time is approximate if no trusted
message timestamp). New information during research gets its own post-prompt
update. Never backdate verification or import later results into an earlier call.
In a fresh chat, assume no prepared thesis, counterpart comparison or retrieval
route exists. Build the missing preparation from current sources; do not claim
to remember this conversation. The procedure and authorization below are complete
without chat history.

An explicit prompt-only/deferred request reuses accepted context without new macro
research; see alert-review mode. All fresh assessment modes use the procedure below.
For conversational assessments and opportunity/holding reviews, also read
[early opportunity discovery and market feedback](references/opportunity-discovery.md).
The dated news-table mode keeps its own currency rows and saved verdict contract.

## Required discovery before the backdrop

1. **Start immediate web discovery and the coverage record together.** Run
   `pnpm analyst discovery start --scope EURUSD --broker <actual-broker> --as-of <UTC-cutoff> --output "Market Analyst Workflow/report/<name>"`
   using the requested scope. This captures fully paginated pins, limitations,
   separate external records and the broker index and creates `discovery.json`.
   If broker identity is unknown, first use `pnpm analyst highlights`; use `status`
   only for unknown availability. A failed local read is an explicit gap, not a
   reason to postpone web research or infer there are no events. Start the first
   headline/official-schedule queries alongside this capture; do not wait through
   failed local reads before beginning web discovery.
   For a requested release wait, pass verified `--release-at <UTC>` and its
   `--deadline <UTC>` (default release + five minutes). When publication is
   imminent/already elapsed, resolve timing, current actuals and decisive
   expectations first. Run remaining discovery alongside that release check;
   neither the local capture nor a full counterpart scan may delay its first verdict.
2. **Immediately batch rigorous web research for both currency stories.** Start
   with the preceding hour, next six hours and overnight stages; also search the
   preceding 24 hours for fresh developments. Inspect official schedules AND fresh
   dated news, including off-calendar catalysts. Follow [source coverage](references/discovery.md)
   for the applicable source families, retrieval/fallback rules and receipt format.
   For USD, always check Treasury auctions, buyback preliminary/final announcements,
   operation windows/results and relevant Fed/New York Fed operations. Do not
   substitute a TIPS auction for a TIPS buyback or confuse offered with accepted
   amounts. Cover other currencies' central banks, statistics and relevant debt,
   fiscal, trade, energy and geopolitical sources. Open decisive source bodies;
   a generic search, stale wrap or empty MT5 calendar is not completed coverage.
   Alongside this focused research, make the brief eight-currency catalyst sweep
   in the opportunity reference. A material candidate outside the requested pair
   gets focused verification, not a full all-pairs inventory.
3. **Pin verified material discoveries as they are found, before expanding the
   backdrop.** Use the standing authorization below. An event can disrupt an
   intraday trade without reversing the wider macro thesis. Uncertain direction,
   an expected outcome or lack of price measurements cannot justify hiding a
   material imminent event. State its time and transmission channel plainly.
   Send a short sourced warning in commentary as soon as a material imminent
   stage is discovered; continue pinning and research in the same turn. Do not
   wait for the backdrop or completed receipt to deliver that warning.
   Record an elapsed stage with unverified results as unresolved, not as released.
   **Send the supported decision promptly.** After checking immediate hazards
   and verifying the dominant mechanism for both requested currencies, give a
   short sourced directional take in commentary. Include an urgent opportunity
   when discovered. Do not wait for the full seven-day scan, backdrop formatting,
   pin persistence or receipt validation. State the scope checked so far and
   continue those obligations in this turn; an early delivery never completes
   the coverage record. A failed write does not erase a supported market judgment.
4. **Extend to the next seven calendar days** for both currencies, or the longer
   holding horizon, across policy/remarks, inflation, labor/wages, activity and
   other material drivers. Check overnight Q&A and separate policy stages. Include
   the next central policy/projection meeting beyond that window when relevant.
   A standalone broad shortlist uses its requested scope/horizon; only an
   unspecified broad shortlist defaults to all eight currencies/90 days. Do not
   turn an ordinary pair assessment into an all-currency inventory.
   The brief opportunity sweep is an explicit exception to scope confinement,
   not a claim that all eight currencies received this full schedule/backdrop pass.
5. **Record evidence as it arrives, then verify before finalizing.** Use
   `discovery record` after each source-open batch, preserving actual tool output,
   retrieval clocks and failures. Mark a partly researched family `partial`,
   not `checked`; do not leave successful retrievals invisible until the final answer.
   Complete `discovery.json` with candidate decisions and
   pin read-backs; run `pnpm analyst discovery validate --input "<discovery.json>"`.
   Fix missing required checks. If a source/write remains unavailable after one
   suitable alternate route, identify that exact gap in the answer and receipt;
   give the best supported assessment, label coverage partial and do not claim
   the scan or icon update completed. The checker verifies recorded coverage and
   persisted pins, not the existence of every possible headline. No workflow
   guarantees exhaustive news discovery. Recheck fresh headlines and nearer
   stages at completion and separately time material post-prompt updates.
   At a declared release deadline use `discovery finish --stop-reason release_deadline`
   with the unfinished-check explanation, then validate. This preserves partial
   work and explicitly defers untouched rows; it does not complete their coverage.
   Never invent failed routes to explain a time limit or claim a fully ranked
   best pair without checking all seven material counterpart stories.

The required local checks find identities and known omissions; they do not make
MT5 the source of truth. Official publishers control schedules/results; dated
reporting and identified market pricing establish expectations and active drivers.
Broad journal/OHLC inventory reads are unnecessary. Fundamental-only is the
default. An explicit price-aware request permits a supplied chart or bounded
price window under the opportunity reference; a no-candles request takes
precedence. Price contradictions trigger research and a decision, not an invented
explanation. Historical event studies remain with Review Historical Research.
Run frontend checks only for implementation work, not research.

## Standing authorization: Highlight and chart icons

Invoking this skill authorizes immediately pinning the material events/headlines
found for the requested currencies and checked horizon, including restoring an
existing relevant archived occurrence and appending sourced External Source facts.
This scope includes a material opportunity candidate promoted by the brief sweep:
complete its focused identity/source checks in a separate currency receipt before
routing its verified event. An unverified idea alone does not authorize a factual pin.
It also authorizes requesting **Show icon on chart** for dated external records.
Do not ask again. An explicit read-only/no-save instruction overrides this default.
It does not authorize trades, service restarts, recurring monitoring, automatic
archiving, impact ratings, full research journals or Thesis writes. Those retain
their separate explicit-request rules; a requested daily Thesis fill is a save.

- Check active/archived identities, relevant limitations and the complete scoped
  broker index/aliases before routing. Reuse the exact occurrence or stable key;
  do not duplicate a broker event merely because it was unpinned.
- Reliable matching MT5 occurrence: pin/restore via [Highlight workflow](../../../docs/HIGHLIGHT-JOURNAL.md).
  Verify its identity, actuals and timing against the publisher. A flawed clock or
  materially mismatched occurrence is not reliable: preserve the raw observation,
  record the discrepancy and pin the sourced official stage in External Source,
  explicitly linking the mismatch so it cannot be mistaken for a second release.
- Absent/unreliable broker event, outside headline or watch: use [External Sources](../../../docs/EXTERNAL-SOURCES.md).
  Save direct source links, facts, affected currencies, real verification clock,
  timing/access notes and exact `event_at` OR source `event_date`. With only a
  verified date, pin date-only; with no date, use an untimed watch and explain
  that no chart timestamp exists. Never invent a marker time.
- New/updated dated external record: append with `"show_on_chart": true`.
  First run `pnpm analyst external preflight` alongside discovery. External CLI
  mutations enforce that probe automatically before touching shared files. Use
  this guarded CLI for analyst writes; do not bypass it with direct Python calls.
  An old/mismatched/unreachable running service blocks writes before mutation.
  Connection refusal permits offline persistence, with live delivery unverified.
  Report the exact runtime gap and continue research; do not restart services.
  Existing active dated record needing only visibility:
  `pnpm analyst external show-on-chart --key <key> --expected-version <latest-id>`.
  Read back the active record and its nonempty `chart_icon_request_id`. The UI
  honors this persisted request across matching pairs, superseding earlier hidden
  preferences; the user can hide it again afterward. No browser automation is
  needed. Read back both local persistence and the matching live route when
  running; a persisted request is not proof that an older UI displayed it.
- Read-back must prove active scope, occurrence/time and latest version. Log writes
  that fail. Preserve histories, existing notes, forecasts, alarm choices and raw
  calendar data. Verified timed pins use Alert's existing reminder mechanism;
  check worker health before claiming delivery. Pinning never starts AI monitoring.

## Choose the requested mode after immediate discovery

- **Currency/pair/Highlight now; release preparation or interpretation:** read
  [fundamental assessment](references/fundamental-assessment.md). Lead with the
  imminent stage when present and a direct BUY / SELL for a pair, or
  STRENGTHENING BIAS / WEAKENING BIAS for a standalone currency,
  dated dominant mechanism and decisive source. Then near-term/upcoming events;
  LOOK HERE NEXT surfaces supported emerging candidates near the top;
  the compact dated backdrop is secondary. A short bias request still gets the
  discovery pass and an imminent warning, without a large table.
- **Upcoming alerts, holding/exit risks or next opportunity:** read
  [alert review](references/alert-review.md). This is part of this skill, not a
  separate invocation. Pin verified material candidates under the same standing
  authorization. Preserve no-save overrides and a prompt-only request's deferral
  of new macro research. Keep execution decisions with the user.
- **Dated eight-currency Thesis fill/save or copied fill-date prompt:** read
  [dated news table](references/daily-news.md) and docs/THESIS.md. Use the shared
  immediate discovery/pinning process, then complete the authorized factual table
  and verify the save. No pair scanning, scores or invented same-date filler.
- **Explicit imminent-release wait:** use [One Minute Before Release](../one-minute-before-release/SKILL.md)
  after discovery/preparation, with its verified target, stopping deadline and
  first sourced verdict. Do not restart the full search or delay a first verdict
  to build the backdrop. The parent invocation's event-pin authorization carries
  through the handoff; full journals/Thesis conclusions still need a save request.
- **Explicit historical price investigation:** use
  [Review Historical Research](../review-historical-research/SKILL.md) for full
  historical measurement. A bounded user-requested price-feedback check is
  covered here and does not require a full historical study.

## Output format

Lead with what matters now. Distinguish the user's supplied observation, verified
facts, attributed reporting and your inference without repeatedly disputing the
observation or burying the warning in caveats. A user timestamp may be recorded
as supplied evidence without claiming independent measurement. Correct a wrong
number plainly; do not let that correction displace the omitted-event warning.
Keep attribution uncertainty specific and brief. Uncertainty about causation is
never a reason to skip discovery, pinning or a material imminent warning.
Give the decision, cutoff/horizon, what changed, dominant reason and one concrete
invalidation. With a prior comparable verdict, state RETAINED or REVERSED; label
a decisive evidence failure as a withdrawal. Use STRONG BUY / STRONG SELL only
when qualitative conviction is supported by the active mechanism outweighing
material opposition, never by the size of a later rally. State material uncertainty
once beside the affected claim. Omit repetitive guarantees, perfect-timing caveats
and defensive conclusions. Established facts and present judgments are direct;
future scenarios remain conditional.

Put LOOK HERE NEXT near the top when the sweep finds supported candidates,
then NEAR-TERM & UPCOMING EVENTS and the compact DATED FUNDAMENTAL BACKDROP.
Do not postpone a supported opposite verdict by leaving it forever as a watch.
For a dated Thesis fill, retain TRADE ENTRY OPPORTUNITY and that mode's existing
saved labels/fields; do not inject pair recommendations or new enums.

Before stopping, report the nearest material Jakarta stage, sourced directional
thesis when requested, successful/reused pins and chart requests, and material
coverage/save gaps. Keep search depth in the evidence, not an inflated answer.
Treat the backdrop as dated context, not a substitute for current event discovery.
A missing transcript or unchanged release need not erase a supported overall bias.
Each invocation ends after its refresh or requested bounded wait; no continuous
coverage, guaranteed reaction speed or exhaustive-news promise is implied.
