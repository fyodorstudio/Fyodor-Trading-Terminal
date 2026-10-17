---
name: assess-trade-now
description: "Give a concise, web-first fundamental trade thesis for a currency, pair or Highlight, with upcoming thesis-changing events and a dated comparison of policy, inflation, labor/wages, growth and other drivers. Also prepare releases; excludes candle analysis and automatic monitoring."
---

# Assess Trade Now

Follow AGENTS.md. Research thoroughly; answer briefly. Infer the requested pair,
event and horizon from the conversation; default to intraday. A short invocation
or "anything new for USD?" is sufficient. Stay within the requested currencies.
Show dates and times in Asia/Jakarta, AM/PM; retain UTC internally. State the
assessment cutoff and horizon. Unknown publication hours stay unknown.

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
- Verify actuals, revisions, reference periods and components. Attribute broker
  forecasts, web surveys and market pricing separately; do not blend them.
  An elapsed release time or new capture timestamp does not establish actuals.
  Search snippets alone cannot verify a decisive claim. If retrieval fails, try
  one suitable alternative route, then identify any material unresolved fact.
- Before drawing a conclusion from rates, compare new guidance and the expected
  pace, extent and duration of policy with prior expectations. Absolute rate levels
  or the headline hike/cut alone do not establish direction. Missing OIS/futures
  evidence prevents claiming measured repricing, but need not block a fiscal,
  growth or haven-demand thesis supported by other evidence.
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

## Direction and conviction

Lead with **STRONG BUY / BUY / MIXED / SELL / STRONG SELL** and a short causal
thesis. Choose the best-supported direction without habitual "slight" or
"low-to-moderate confidence" qualifiers. No separate confidence field is needed.

Use STRONG BUY or STRONG SELL when verified current evidence establishes a
dominant relative mechanism over the stated horizon. One powerful catalyst can
outweigh several weaker or older opposing indicators. Do not require all data,
both central banks or every source to agree; do not count releases as votes.

For fiscal, funding, geopolitical or intervention shocks, establish whether the
pressure is active, escalating or resolving and why the counterpart benefits.
The counterpart's domestic data need not improve for relative demand to favour it.
Do not downgrade automatically for routine counterevidence, an upcoming release,
uncertain move size, or unavailable pricing unrelated to the dominant mechanism.
Reduce conviction when fresh opposing evidence materially challenges that mechanism
or a missing decisive fact could reverse the conclusion. If the evidence is
balanced or the direction cannot be established, say MIXED and name the specific
conflict briefly; do not fabricate facts to force a strong label.

Example thesis wording, when supported by contemporaneous evidence:
"EURCHF: STRONG SELL — European fiscal stress drives selling of EUR and demand
for CHF safety; Swiss economic data does not need to improve for that trade to work."
This illustrates catalyst dominance, not a standing EURCHF call or a verdict
assigned from a later chart. An older policy decision alone should not dilute an
active stress thesis; a fresh change in the expected policy path may challenge it.

## Continuation, retracement or a changed thesis

Reassess the dominant mechanism on every invocation. Fresh guidance can reduce
near-term tightening urgency even while inflation stays high. Explain whether new
information reinforces the thesis, supports an opposite near-term direction or
invalidates it. Do not carry an earlier verdict forward automatically or invent a
retracement merely because the user missed a move. Directional conviction and
precision about timing or eventual pip distance are separate judgments.

Distinguish a one-off surprise from a continuing pressure. An earlier policy
disappointment does not by itself establish fresh selling pressure days later.
Check whether subsequent guidance, trading-partner news, global financial
conditions or haven demand has changed the relative story. A recovery can have
fundamental support without the original central bank reversing its message.
Name the first verified contrary development and its implication when available;
do not relabel every counter-move as profit-taking or short covering without
evidence. A reported chart trend or the user's preferred verdict does not establish
the macro conclusion. Keep the strongest opposing mechanism visible briefly.

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

Keep future scheduled releases in Upcoming, not mixed with occurred observations
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

1. **[Jakarta date] TRADE ASSESSMENT** — as of [time], [horizon].
   **[PAIR]: [VERDICT] — [one or two sentences explaining the dominant driver].**
   Link the decisive evidence beside the thesis. If several recent developments
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

Dates refer to the actual event/publication, not the reference month or retrieval.
Use approximate calendar-day age for untimed old news; do not invent precise ages.
Cite direct web links and absolute paths for any local evidence actually used.
Keep research depth out of the response unless the user asks for detail.

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

## Eight currencies, only when requested

Cover USD, EUR, GBP, JPY, CHF, CAD, AUD and NZD only when explicitly requested.
For best-pair selection after a named currency's event, compare its seven crosses
or the user's narrower candidates; do not expand to all 28 pairs. Refresh every
candidate's material fundamentals and exceptional news, then give one leading pair
and a brief alternative only if useful. Before actuals, candidates stay conditional;
choose the release-supported pair after verifying the decisive package. Macro
alignment alone does not rank pip distance, profitability or implied volatility.

When the user or a Thesis dock prompt explicitly requests saving, follow the
[Thesis workflow](../../../docs/THESIS.md). Read the pair/month first, then append
the compact sourced verdict/thesis using the exact target or standalone row and
latest predecessor. Preserve real research/saved clocks; the JUL-only display
never authorizes backdating. A historical reconstruction is labelled as such.
Link full Highlight research when available rather than duplicating its body.
Do not create placeholders or upcoming rows. Answer in chat as usual and confirm the save or disclose a write failure without claiming
the dock updated. Do not pin/archive or alter raw data to make a row appear.

Answer in chat. Save research only when requested, preserving Before/After phases,
append-only versions, user notes and raw observations; leave price_reaction empty.
No trades, account changes, service restarts, messages or recurring monitoring
are implied by an assessment.
