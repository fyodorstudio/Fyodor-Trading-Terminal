# Dated Thesis news table

Use this mode when asked to fill the Thesis table for a date, including the dock's
Copy fill-date prompt. Read docs/THESIS.md for the JSON contract. This request
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
still requires refreshing all eight. A checkpoint refresh or skill invocation
alone does not authorize a Thesis save or continuous monitoring. Significant
checkpoint reminders use the parent skill's separate standing permission.

Maintain the left-panel summary through saved daily directions, not a second
verdict file. Read `pnpm analyst thesis summary --scope ALL` alongside context.
Select each currency's nearest material `direction.reassessment` under
[the summary contract](../../../../docs/THESIS.md#left-panel-summary-and-reassessment),
with verified schedule, sources and a note explaining what to reassess. If no
schedule is verified, give `reassessment_gap`. Resolve elapsed checkpoints before
selecting new ones; do not automatically skip to the next policy decision. Carried
rows retain their original verification clocks/deadlines and may remain Review due.
Detailed retained/reversed evidence belongs in Thesis. Read back the summary and
saved review; historical reconstructions must not replace the live projection.

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
