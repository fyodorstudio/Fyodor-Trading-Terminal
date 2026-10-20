---
name: assess-trade-now
description: "Assess a currency, pair or Highlight using web-first fundamentals, or fill and save the Thesis dock's dated eight-currency news table. Also prepare releases; excludes candle analysis and automatic monitoring."
---

# Assess Trade Now

For a request to fill/save the Thesis date table or its copied fill-date prompt,
use [Dated Thesis news table](references/daily-news.md) and docs/THESIS.md. That
mode saves factual news, a strengthening/weakening verdict for every currency and
a top standalone currency opportunity summary confined to that Jakarta date.
Choose the dominant direction; a preference for caution is not a third verdict.
Do not scan pairs or use the general assessment format below. Complete the
saved table and verify the write before giving a brief chat confirmation.

Follow AGENTS.md. Research thoroughly; answer briefly. Infer the requested pair,
event and horizon from the conversation; default to intraday. A short invocation
or "anything new for USD?" is sufficient. Stay within the requested currencies.
Show dates and times in Asia/Jakarta, AM/PM; retain UTC internally. State the
assessment cutoff and horizon. Unknown publication hours stay unknown.

## Prompt-time bias and evidence cutoff

The primary result is the fundamental bias at the user's invocation time over the
requested horizon, defaulting to intraday. Establish that cutoff before research:
use a trusted message timestamp when available; otherwise read the clock immediately
and label the first-observed time as approximate. Never invent the exact prompt
second or silently substitute the answer's completion time. An explicit user-chosen
historical cutoff takes precedence.

Use only information available by that cutoff to determine its bias. A release
published during research belongs in a separately timed post-prompt update when
material; preserve the original information set and verdict. Later reporting may
help locate earlier evidence, but verify its original availability before using it
for the cutoff. If publication timing could change a before/after conclusion and
cannot be resolved, disclose that gap and keep the claim conditional.

A user limit such as "only the past two days" limits the displayed recent context.
Read earlier guidance when needed to establish the current policy stance,
expectations or whether a catalyst remains active, without expanding the displayed
event history. Retain its original date in the evidence; never manufacture a new
development to fit the window.
If the user explicitly restricts the evidence itself, respect that restriction and
identify any resulting decisive gap. Prioritize today's actual information and the
nearest material checkpoints without treating future outcomes as current support.

## Web-first research

- Use current web evidence as the primary source. Search both currencies' latest
  policy, inflation, growth/labor and material off-calendar developments. Follow
  the dominant story beyond calendar releases: fiscal/bond stress, energy,
  geopolitics, intervention, funding and demand for safety can drive the pair.
- Search extensively enough to establish the dominant mechanism, its current
  status and strongest competing explanation. Open decisive sources, check their
  dates and follow newer developments. Prefer original official publications for
  facts and contemporaneous reporting for expectations and market conditions.
  Batch independent checks; stop when further searching adds no material evidence.
- Date the underlying release, speech or development separately from the article's
  publication/update and retrieval. A new article repeating older remarks does not
  create a fresh policy signal. Read decisive passages with their qualifications;
  preserve an expected pause, lack of urgency, conditional guidance and contrary
  components even when the headline emphasizes inflation or further tightening.
- Local datasets and saved research are optional aids, not prerequisites or a
  reason to delay a web-supported thesis. For an explicitly named Highlight,
  resolve its ID, broker and occurrence with focused `pnpm analyst highlights`
  and `--summary` reads; this identifies the event without requiring a broad local
  investigation. Read local journals/external records when they add useful context
  or the user asks. Preserve their dated status; fresh web evidence takes priority
  for today's interpretation. Do not change raw calendar observations.
- In a fresh session, default a manual news update to the past 24 hours, including
  overnight developments. In an ongoing session, compare with the prior cutoff
  and check newly discovered earlier material news. Do not claim memory of an
  unsaved verdict. Each invocation performs one refresh, then stops.
  Before settling on a driver, check for later policy remarks, parliamentary
  testimony/Q&A and material off-calendar developments through the cutoff. Use
  official release/speech listings and dated reporting; a familiar older article
  or an empty scheduled calendar does not establish that nothing newer occurred.
- Verify actuals, revisions, reference periods and components. Attribute broker
  forecasts, web surveys and market pricing separately; do not blend them.
  An elapsed release time or new capture timestamp does not establish actuals.
  Search snippets alone cannot verify a decisive claim. If retrieval fails, try
  one suitable alternative route, then identify any material unresolved fact.
- Before drawing a conclusion from rates, compare new guidance and the expected
  pace, extent and duration of policy with prior expectations. Reconcile the next
  meeting's hold/hike/cut expectation with the later path and policymakers' urgency
  after the latest information. Attribute official guidance, economist forecasts
  and identified market pricing separately, with their own observation times.
  Absolute rates or the headline hike/cut alone do not establish direction. Claim
  repricing only with comparable dated pricing evidence; a forecast, rate spread
  or currency move alone does not establish a change in expectations. Missing
  OIS/futures evidence need not block a supported fiscal, growth or haven thesis.
  An already-expected pause is not fresh dovish news. Explain whether the latest
  information changes the expected path or preserves it; assess continuing
  tightening support alongside any near-term patience.
- For historical as-of requests, use only evidence public by that cutoff. Keep
  later confirmation separate. A date without an hour does not license importing
  end-of-day reporting into a pre-release verdict; identify the information cutoff.
  Use the historical-research skill only for an explicitly requested price study.
  For a range ending now with a future extension, distinguish developments since
  the range began, today's assessment and the conditional future outlook. Future
  dates are scenarios using today's information, not assessments already observed.
- Never fetch, open or analyze candles/OHLC, saved price reactions, chart attachments
  or technical indicators in this workflow. User technicals are execution context,
  not confirmation of the fundamental thesis.

## Direction and dominant reason

For each requested currency, lead with **STRENGTHENING BIAS** or **WEAKENING BIAS**
and explain the dominant fundamental reason at the prompt cutoff. For a requested
pair, use the same labels for the base currency relative to the quote currency.
These are the only directional labels: no buy/sell ratings, numeric scores,
strength bands, intensity adjectives or confidence grades. Explain the mechanism
instead of qualifying the label. Do not use a catch-all verdict for conflicting
indicators or assume that every variable has equal weight.

Every directional verdict must explain why the verified mechanism supplies active
support or pressure at the cutoff over the requested horizon. Distinguish a
continuing policy backdrop, a fresh change in expectations and a conditional future
catalyst. A continuing mechanism can support direction without new data on every
invocation. If material contrary evidence exists, explain why the chosen mechanism
still dominates it; do not manufacture an opposing case to complete the format.
An intraday verdict must not be inferred solely from a possible hike months ahead.

For example, "further hikes likely, next meeting expected to hold, no urgency"
describes a possible later tightening path with near-term patience. Preserve both
parts: neither automatic strengthening from eventual hikes nor weakening from
patience follows. Determine which mechanism dominates now, including current
counterpart policy, growth, funding or haven conditions where relevant. Weigh
causal relevance, current status, timing and policy implications; do not treat
contradictory releases as equal votes. A dominant active catalyst can outweigh
several secondary or older indicators. Agreement across all data or banks is not
required. An upcoming event or ordinary uncertainty about timing does not excuse
withholding a supported directional assessment.

For fiscal, funding, geopolitical or intervention shocks, establish whether the
pressure is active, escalating or resolving and why the counterpart benefits.
The counterpart's domestic data need not improve for relative demand to favour it.
Do not abandon a supported direction automatically for routine counterevidence,
an upcoming release, uncertain move size, or unavailable pricing unrelated to the
dominant mechanism.
Reassess which mechanism dominates when fresh opposing evidence challenges it.
If a genuinely decisive evidence gap or unresolved conflict prevents a defensible
direction after research, state "Bias cannot be established" and name the exact
missing fact or unresolved mechanism. This is an exceptional evidence limitation,
not a routine third rating or a substitute for weighing the fundamentals. Never
invent a direction merely to populate the table.

Counterweights are optional. Search for contrary evidence internally, but show it
only when verified, active at the cutoff and material enough to challenge the
dominant mechanism over the requested horizon. A generic haven possibility, a
distant conditional hike or an upcoming release alone is not a counterweight.
Omit the counterweight sentence or column when nothing material is established;
if a shared table column is needed for other rows, use an em dash in that cell.
An empty cell means no material counterweight was established in this assessment,
not proof that no risk exists. Do not add hypothetical filler or routine disclaimers.

Example thesis wording, when supported by contemporaneous evidence:
"EURCHF: WEAKENING BIAS — European fiscal stress drives selling of EUR and demand
for CHF safety; Swiss economic data does not need to improve for that trade to work."
This illustrates catalyst dominance, not a standing EURCHF call or a verdict
assigned from a later chart. An older policy decision alone should not dilute an
active stress thesis; a fresh change in the expected policy path may challenge it.

### Evidence required for the dominant reason

Keep observed facts, attributed market interpretation and your own causal inference
distinct. A report that AUD/NZD rose against USD does not establish yen-funded
purchases. A strong domestic bond auction does not establish foreign inflows or
currency buying. A currency move alone does not identify its cause.

When relying on carry, yield divergence, risk appetite or haven demand, name the
currencies involved and verify the relevant comparison. Use dated policy rates
and expected paths when rates drive the claim. Identify what makes that mechanism
active over the requested horizon; a standing yield gap and a generic risk-on
headline alone do not establish dominance over current tightening guidance.
Attribute a source's flow explanation and label an inferred channel as inference.
Do not present the channel as observed positioning without supporting evidence.

Read the decisive source's body and qualifications, then seek evidence that could
overturn its interpretation. Multiple syndications of one report are one evidence
chain. Source count does not determine direction: one decisive announcement can
establish a catalyst, while several articles repeating a narrative cannot establish
unobserved flows. Check whether fiscal/funding stress has eased before carrying
an earlier stress explanation forward; stabilization alone does not prove currency
appreciation.

Before publishing, trace the proposed verdict internally from dated fact to
mechanism to requested horizon. Compare it with the strongest verified opposing
mechanism, including continuing policy support, and state briefly why it dominates
when that opposition is material. Check for omitted newer remarks and preserve
next-meeting expectations, the later path and qualifications. If the causal link
is unsupported, investigate or narrow the claim before choosing the label. Do not
default to uncertainty merely because pricing or flows are unobservable when other
evidence establishes direction. Keep this check internal and the answer compact.

## Thesis change relative to an earlier assessment

When a prior pair assessment is available, distinguish pair bias from the change
in evidence for that earlier directional case. Explain the change and its causal
reason in plain prose, without magnitude ratings. A less persuasive strengthening
case does not by itself establish weakening; a reversal requires a supported
opposite mechanism. A newly researched interval has no implied prior verdict;
legacy unassessed changes stay unknown.
Do not preserve a stance mechanically or rewrite history to match a later rally.
Use actual invocation cutoffs; historical rows follow material information and
verified publication timing rather than a fixed 1:00 PM daily snapshot. Unknown
publication hours remain explicit. For a requested Thesis save, record the exact
earlier version ID and change reason following docs/THESIS.md.

When rechecking a challenged answer, distinguish newly published information from
previously available evidence you missed. Correct an unsupported inference at its
original cutoff; do not describe the correction as a market reversal. Apply the
same evidence standard to retaining, reversing or withdrawing the earlier verdict;
user disagreement alone establishes none of those outcomes.

## Continuation, retracement or a changed thesis

Reassess the dominant mechanism on every invocation. Fresh guidance can reduce
near-term tightening urgency even while inflation stays high. Explain whether new
information reinforces the thesis, supports an opposite near-term direction or
invalidates it. Do not carry an earlier verdict forward automatically or invent a
retracement merely because the user missed a move. Fundamental direction and
precision about timing or eventual pip distance are separate judgments.

Distinguish a one-off surprise from a continuing pressure. An earlier policy
disappointment does not by itself establish fresh selling pressure days later.
Check whether subsequent guidance, trading-partner news, global financial
conditions or haven demand has changed the relative story. A recovery can have
fundamental support without the original central bank reversing its message.
Name the first verified contrary development and its implication when available;
do not relabel every counter-move as profit-taking or short covering without
evidence. A reported chart trend or the user's preferred verdict does not establish
the macro conclusion. Show an opposing mechanism only when it meets the material
counterweight rule above.

## Fundamental backdrop: recent and prior evidence

Research all five categories below for each requested currency on the web, even
when the dominant thesis is an off-calendar shock. Local MT5 data is optional.
Use a compact comparison table with categories as rows and the requested currencies
as columns (EUR and CHF for EURCHF). For a currency-only request use one currency
column; do not expand the scope merely to fill a table.

- **MONETARY POLICY:** current stance and latest decision; fresh guidance,
  official projections and the expected future rate path, including next-meeting
  expectations when available. Distinguish central-bank forecasts/conditional
  paths, economist surveys and identified market pricing, with their own dates.
  Explain what changed; an old hike or today's rate alone is not a fresh signal.
- **INFLATION:** latest headline/core package and material services or other
  components; compare the prior reading and attributed expectations where useful.
  Explain implications for the bank's concern and future policy response.
- **LABOR / WAGES:** employment, unemployment, wage growth and labor tightness
  where available. Wage/earnings or negotiated-pay data belong here, even when
  released less frequently than employment. Explain the growth/inflation channel.
- **GROWTH / ACTIVITY:** latest material GDP, PMIs, consumption/retail sales,
  production or other activity evidence and its change from the relevant prior.
- **OTHERS:** material fiscal/bond stress, energy, trade, geopolitics,
  intervention, funding or haven demand; select what matters to this pair.

Each cell contains the latest relevant evidence's publication date/age, key result
or change versus the comparable prior/expectation, a short currency implication
and direct source link. Use one or two short statements per cell; do not dump
release histories. Order multiple items within a cell newest first. Mark older
retained facts as Background when relevant, and distinguish an older policy
level from newly published guidance or rate-path expectations. The latest
quarterly wage/GDP release may still matter: age alone does not make it stale.
State unavailable or conflicting material evidence briefly instead of inventing
numbers or padding a cell. Do not turn the table into a vote or numeric score;
the dominant-driver thesis still determines the overall verdict.

Keep future scheduled releases in Upcoming, separate from occurred observations
in the table. A forecast published before the cutoff belongs in the backdrop as
a dated expectation; the future meeting/release and its conditional implications
belong in Upcoming. Do not repeat the same evidence in both sections.

## Upcoming events that could change the thesis

Research both currencies' material scheduled events and policy stages for at least
the next seven calendar days, or the longer requested holding horizon. Use official
schedules and credible current calendars; a local calendar is optional. Check nearer
speeches/Q&A and overnight stages before suggesting a later major release. Scan
all five backdrop categories, including labor/wages and growth as well as rates
and inflation. Include the next material policy meeting or projection release
beyond the seven-day window when it is central to the thesis, clearly dated as
outside that window; do not expand every minor-data search indefinitely. Separate
decisions, statements, projections and press conferences.

Show only material candidates, earliest first, with verified Jakarta date/time and
the latest attributable expectation when available and one short outcome that
would strengthen, weaken or reverse the thesis. Explain the policy/growth/risk
mechanism rather than treating every higher/lower reading mechanically. Unknown
consensus stays unknown; do not recycle stale forecasts as current expectations.
Distinguish ordinary volatility from a change in the dominant driver. Include specific
unscheduled risks after timed events, with an evidence trigger and no invented date.
Put a material coverage gap here if it affects the reassessment plan; do not issue
an all-clear from absent icons. A credible fiscal resolution, verified intervention
or a changed policy path can matter more than the next routine data release.

If useful, suggest returning ten minutes before the nearest decisive event within
that event's bullet. This does not schedule a notification. Do not prescribe closing
before every release, a holding deadline, entry hour, price, stop, target or size.

## Output format

Use this compact structure for pair assessments and adapt it to currency-only
updates. Use only the compact backdrop comparison table by default; keep the
thesis and Upcoming in prose/bullets. No mandatory entry-date declaration, entry
eligibility gate, confidence boilerplate, separate risk checklist or long conclusion.

1. **[Jakarta date] TRADE ASSESSMENT** — as of [prompt-time cutoff, with available precision], [horizon].
   **[PAIR]: [STRENGTHENING BIAS or WEAKENING BIAS] — [dominant reason].**
   Link the decisive evidence beside the thesis with its explicit evidence date.
   If several recent developments
   need individual explanation, add short dated bullets here, newest first; include
   only developments material to the current view and briefly integrate a material
   counterargument or unresolved fact. Do not repeat the verdict afterward.
2. **UPCOMING EVENTS THAT COULD CHANGE THE THESIS**
   Dated bullets, earliest first: event, Jakarta time, source and what outcome
   changes the thesis. Include a concrete shock/reversal trigger here when material.
3. **FUNDAMENTAL BACKDROP — RECENT & PRIOR**
   Use the five-category table described above, with one column per currency.
   It replaces the rates-only stale-event list. Include policy/rate projections,
   inflation, labor/wages, growth/activity and relevant other drivers. Keep dates,
   ages, changes and implications concise; distinguish recent evidence from older
   Background rather than calling every prior event stale.

   | Category | EUR | CHF |
   | --- | --- | --- |
   | MONETARY POLICY | Dated stance/guidance and expected rate path; implication | Dated stance/guidance and expected rate path; implication |
   | INFLATION | Latest package versus prior/expectation; implication | Latest package versus prior/expectation; implication |
   | LABOR / WAGES | Latest jobs/pay evidence; implication | Latest jobs/pay evidence; implication |
   | GROWTH / ACTIVITY | Latest material activity evidence; implication | Latest material activity evidence; implication |
   | OTHERS | Relevant fiscal/energy/risk news; implication | Relevant fiscal/energy/risk news; implication |

   The currency headings above illustrate EURCHF; substitute the requested scope.
   Every populated cell needs its evidence date/age and source, not just the
   generic descriptions in this template. Do not add another stale-events list.

Every cited factual claim, including a counterweight, needs a visible date beside
the evidence and link (for example, "19 Oct — [Reuters](URL): ..."). A link alone
is insufficient. Dates refer to the actual event/publication, not the reference
month or retrieval.
When a report repeats older remarks, identify the original remark date and the
report date separately if both are relevant; never redate the remarks. An unknown
evidence date stays unknown and cannot establish a fresh directional catalyst.
Use approximate calendar-day age for untimed old news; do not invent precise ages.
Cite direct web links and absolute paths for any local evidence actually used.
Keep research depth out of the response unless the user asks for detail.
If material information arrived during research, give any post-prompt update its
own cutoff; do not imply the original verdict knew that information. A later
verification time is separate from when the evidence became public.

## Release preparation and countdown handoff

Before publication, distinguish the existing pair thesis from conditional release
outcomes; an upcoming event does not automatically force the general pair view to
wait. Identify the actual surprise or guidance change needed to alter the thesis.
Prepare the exact release identity, verified publication stages, reference period,
units, separately attributed expectations, direct official retrieval route and one
fallback. Identify decisive revisions/components and simultaneous publications.
Retain the relevant fundamentals, sources, scenarios and upcoming scan in the
conversation without a second long handoff report.

For an explicit imminent-release wait, use
[One Minute Before Release](../one-minute-before-release/SKILL.md). It reuses the
preparation, checks actuals and intervening news, sends a short sourced first
verdict, then uses the compact output above. Preparation alone starts no timer.

## Standalone currencies and pair selection

For standalone currency requests, cover exactly the requested currencies. Cover
USD, EUR, GBP, JPY, CHF, CAD, AUD and NZD together only when all eight are requested.
Use one table: Currency | Strengthening / weakening bias and dated reason |
Next material checkpoint. Add an optional Material counterweight column only
when at least one row has qualifying evidence; leave other cells as an em dash.
Do not invent content for a column or turn standalone rows into pair calls.
The usual pair-format sections are unnecessary for this overview.
Apply the same prompt-time cutoff and policy-expectation checks to each currency;
different source coverage must not become assumed neutrality or broad strength
against all seven counterparts. State material gaps in the affected row. Respect
the user's display window and show only context needed for its current bias and
checkpoint. Save the table only when explicitly requested, as described below.
If a standalone thesis depends on a particular counterpart, name it and bound
the inference to that comparison. Research the material counterpart facts needed
for the claim without expanding into unsolicited cross rankings or all seven
currency assessments.
For best-pair selection after a named currency's event, compare its seven crosses
or the user's narrower candidates; do not expand to all 28 pairs. Refresh every
candidate's material fundamentals and exceptional news, then give one leading pair
and a brief alternative only if useful. Before actuals, candidates stay conditional;
choose the release-supported pair after verifying the decisive package. Macro
alignment alone does not rank pip distance, profitability or implied volatility.

For a pair assessment save (the dated news-table mode above is separate), follow the
[Thesis workflow](../../../docs/THESIS.md). Read the pair/month first, then append
the compact sourced verdict/thesis, change and its comparison evidence using the
exact target or standalone row and latest predecessor. Preserve real
research/saved clocks; the selected month
never authorizes backdating. A historical reconstruction is labelled as such.
Link full Highlight research when available rather than duplicating its body.
Create blank planning rows only when explicitly requested; preserve their empty
bias/thesis until a real assessment is saved, following the Thesis workflow.
Answer in chat as usual and confirm
the save or disclose a write failure without claiming the dock updated.
Do not pin/archive or alter raw data to make a row appear.

For a requested saved review, first use `pnpm analyst thesis context --scope <PAIR|ALL>`
to retrieve bounded prior context across months. Refresh decisive web evidence and
actively seek contrary developments; archive size does not increase a thesis's
validity. Across All Currency now uses the dated news-table workflow linked above;
do not save legacy bias/counterweight views for that table. Pair research retains
the five-category backdrop and exact linked assessment versions. Save the real `planning_as_of_utc` separately
when preparation follows the research cutoff. Carry facts with their original publication
and verification dates; advance verification only when actually rechecked. New
cutoffs create new reviews; corrections preserve cutoff/history. Keep conditional
or weakened cases explicit without manufacturing an opposite entry. The dock keeps
supporting research in the saved record/export; no daily maintenance or monitoring is required.

Answer in chat. Save research only when requested, preserving Before/After phases,
append-only versions, user notes and raw observations; leave price_reaction empty.
No trades, account changes, service restarts, messages or recurring monitoring
are implied by an assessment.
