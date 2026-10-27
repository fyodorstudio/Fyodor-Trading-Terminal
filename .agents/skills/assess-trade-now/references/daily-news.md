# Dated Thesis news table

Use this mode for requested Thesis date fills, including the dock's Copy fill-date
prompt, and the standing focused live-summary workflow in the parent skill.
Read docs/THESIS.md for the JSON contract. A date-fill request
authorizes saving that date; date selection alone invokes nothing. Complete the
research and persisted table before responding, then confirm the date, any gaps
and the successful save briefly. A short chat answer cannot replace the save. The parent skill's immediate
discovery, coverage receipt and material-event pin/icon authorization also apply;
date selection alone remains read-only and creates no monitoring.

Prefer one baseline fill before the user's main trading session, followed by
selective refreshes at thesis-changing checkpoints rather than a fixed twice-daily
quota. Each assessment should identify the nearest useful return event, its
verified Jakarta time (or unknown hour), affected currencies and what to reassess.
Use the earliest material stage, not only the next headline policy decision.
An entry review is warranted when material news arrived after the saved cutoff.
On a requested focused refresh, research affected mechanisms and material
counterparts; retain other rows with their original verification clocks and mark
them as carried context, not freshly researched. A request for all currencies
still requires refreshing all eight. Live Assess Trade Now and release invocations
have standing permission to refresh an existing live ALL snapshot, unless explicitly
read-only, chat-only or no-save. No continuous monitoring follows. Significant
checkpoint reminders use the parent skill's separate standing permission.

Maintain the left-panel summary through saved daily directions, not a second
verdict file. Read `pnpm analyst thesis summary --scope ALL` alongside context.
Select each currency's nearest material `direction.reassessment` under
[the summary contract](../../../../docs/THESIS.md#left-panel-summary-and-reassessment),
with verified schedule, sources and a note explaining what to reassess. If no
schedule is verified, give `reassessment_gap`. Resolve elapsed checkpoints before
selecting new ones; do not automatically skip to the next policy decision. Carried
rows retain their original verification clocks/deadlines and may remain Review due.
Detailed retained/reversed evidence belongs in Thesis. Save `direction.evidence_anchor`
under the summary contract: original decisive supporting event time/date, title,
sources and timing note. Preserve its age when retaining a mechanism; never
substitute invocation, verification or an unrelated newer headline. Unknown hours
stay date-only. Read back the summary and saved review; historical reconstructions
must not replace the live projection.

Choose checkpoints per saved comparison and horizon, not by copying the next
global release into every row. In each note name the relevant counterpart(s),
the transmission channel and what result would materially challenge or reinforce
the dominant mechanism. A US release can require review of EUR versus USD without
changing EUR's domestic outlook; it does not automatically expire AUD versus NZD
or CAD versus EUR/JPY. Sharing a checkpoint is valid only when each comparison
has a supported material link. General global exposure, simultaneous volatility
or an event's headline importance alone is insufficient. Keep lesser execution
hazards and routine operation stages visible in Upcoming/Alert without making
each one a verdict deadline. Do not force distinct dates either: select the
nearest genuinely material stage, including a counterpart event or relevant
remarks before the next headline decision, and explain why nearer watch items
do not warrant expiry. Unscheduled shocks remain immediate review triggers.

When a user asks to resolve Review due or correct saved checkpoints, treat that
as a focused Thesis-update request. Interpret the elapsed material package,
research the affected comparisons, append retained/reversed evidence and the
new checkpoint, then read back the monthly version and live summary. Check
other elapsed stages before rolling forward. Preserve unaffected carried rows'
verification clocks, evidence ages and deadlines; do not imply that every row
was freshly researched. A live release invocation uses the standing focused-save
permission; an alarm alone performs no research or write.

On a Jakarta date change, append at the actual new-day cutoff. Move prior-day
news out of the new day's `news` arrays, preserving the original snapshots and
carrying still-active facts through dated direction sources/reasons. Do not redate
old news or copy expired entry windows. Retain unaffected verification clocks,
anchors and future checkpoints with explicit carried-context notes. If the result
is missing at the bounded deadline, save that limitation and supported retained
direction; choose a sourced follow-up or explain `reassessment_gap`, never invent
a release or extend the wait to clear Review due.

- Cover USD, EUR, GBP, JPY, CHF, CAD, AUD and NZD in one currency row each. The
  columns are Currency | DD:MM:YYYY FUNDAMENTAL | SOURCE | UPCOMING CHECKPOINT.
  Summaries and source groups share their list numbers; several links supporting
  one item keep one number. Begin each Fundamental cell with POTENTIAL
  STRENGTHENING or POTENTIAL WEAKENING and a short dominant-driver explanation
  specifically for the selected day. These are the only two verdicts. Do not use
  a neutral, mixed, unavailable or no-clear-opportunity verdict. A preference for
  caution must never replace a directional judgment: weigh evidence by causal
  importance, not equal votes, and choose the dominant direction despite ordinary
  opposition. Pending releases belong in Upcoming and do not block the verdict.
  If a claim cannot be verified, try another source or exclude that claim; continue
  the assessment using verified evidence. Older still-active context can inform
  direction, retaining its original date; do not redate it as same-day news.
- At the top show TRADE ENTRY OPPORTUNITY: zero or more supported standalone
  currency entries, strongest first, plus separate supported commodity entries.
  Follow entry-decisions.md: active/conditional stage, activation, expectation
  baseline, new information/continuing pressure, remaining case, potential buying/
  selling with observed/reported/inferred basis, horizon, bounded feedback and
  invalidation. Eight directional currency verdicts remain required; an entry
  is not required. If neither kind qualifies, save opportunity_gap explaining
  why. Do not scan pairs, use scores, invent investor flows or pad commodities.
  Requalify previous saved opportunities under the shared freshness rules; do not
  copy their status/windows forward. Explain retired cases in the new snapshot's
  note or opportunity_gap as applicable, preserving all earlier versions.
- Aim for at least four distinct relevant news items per currency published on
  the requested Jakarta date. Research policy/remarks, inflation, labor/wages,
  activity and material fiscal, trade, energy or geopolitical developments. This
  is a search target, not a minimum save gate or a reason to pad quiet days. Use
  fewer when fewer are verified and explain material coverage gaps. Syndications,
  components of one release and repeated older remarks count as one development.
- Open direct official releases and dated reporting. Check later testimony/Q&A
  and off-calendar updates through the cutoff. State the verified news plainly:
  actual/prior/revisions, announcement or remarks, with forecasts and opinions
  attributed to their provider. Report forecasts as forecasts. Do not convert a
  price move, rate gap or market narrative into an unverified causal assertion.
  New commentary does not redate its underlying old news. News collection does
  not fetch eight histories. Bounded feedback is permitted only for shortlisted
  entry candidates, subject to explicit fundamental-only/no-candles overrides.
- For today, use the real research cutoff and include only news then available.
  Direction is the assessment at that cutoff, not a whole-day forecast. When a
  same-day reassessment changes it, name the decisive development in the reason;
  preserve the earlier snapshot so the table can show both timed views. Do not
  backdate the change to a guessed market turn or publication minute. Supply
  published_at only when independently verified; SOURCE distinguishes that
  publication clock from verified_utc. Unchanged refreshes need no reversal line.
  A past-date request authorizes a labelled reconstruction through its requested
  cutoff, or the end of that Jakarta day if no hour is given. Future dates stay
  unfilled. Preserve original publication dates/known hours, real retrieval clocks
  and writer-assigned saved time; historical verification can occur today and must
  not be backdated. A source published later cannot establish what was known then.
- Upcoming contains only scheduled news still ahead at the saved cutoff, earliest
  first, with verified Jakarta AM/PM times or an explicit unknown hour. Scan the
  following seven days and the next material policy meeting. A later-today release
  can be upcoming; once published, its verified result belongs in Fundamental on
  a requested refresh. Use factual titles/notes, not hypothetical trade outcomes.
  Historical checkpoints must use schedules known at that historical cutoff.
- Read the requested month and bounded `thesis context --scope ALL`; use saved
  news as dated evidence, then research missing items and refresh direct sources.
  Append `format: "daily_news"` with all eight `currency_views`; use `news` and
  `news_gap`, plus `direction` containing `verdict`, `reason`, real `verified_utc`
  and direct `sources`. Save `entry_opportunities` (possibly empty) and optional separate
  `commodity_opportunities` under docs/THESIS.md. New entries include stage,
  activation and sourced evidence in addition to summary/window/invalidation.
  With no entries of either kind, require an explicit `opportunity_gap`. Both offset-aware window instants must stay
  within the selected Jakarta date, start before end. Today starts at/after the
  research cutoff and ends by 11:59:59 PM Jakarta; narrow timing only with verified
  catalysts. Otherwise describe cutoff through the remaining day as a research window,
  not an execution recommendation. Closed markets do not become active entries
  merely because a date has room left. Next-session opportunities outside the
  selected date belong in chat/Upcoming, not a fabricated same-day window. Historical windows must use evidence known
  at their start and be labelled retrospective, never later same-day hindsight.
  Later-date releases stay in Upcoming. Omit legacy interpretation fields, pair
  opportunities and the mandatory assessment backdrop. Do not overwrite old
  assessments or user notes.
- Append through `pnpm analyst thesis review-append --scope ALL`, then read the
  requested month back and check returned version ID, Jakarta date, all eight
  rows, both-choice daily verdicts, strongest currency summaries, same-day windows,
  summary/source correspondence and future checkpoints. Report write/read
  failures honestly. A new cutoff creates a new snapshot; a correction retains
  cutoff and appends with the latest predecessor. No automatic upkeep is implied.
