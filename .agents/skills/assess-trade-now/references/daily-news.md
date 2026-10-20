# Dated Thesis news table

Use this mode when asked to fill the Thesis table for a date, including the dock's
Copy fill-date prompt. Read docs/THESIS.md for the JSON contract. This request
authorizes saving that date; date selection alone invokes nothing. Complete the
research and persisted table before responding, then confirm the date, any gaps
and the successful save briefly. A short chat answer cannot replace the save.

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
- At the very top show TRADE ENTRY OPPORTUNITY: an even shorter ordered summary
  of the strongest standalone currency directions, strongest first. Do not scan
  pairs, form crosses or create pair recommendations. Select one or more currencies
  based on the dominant mechanisms, without numeric scores or confidence grades.
  Give each a sourced direction (from its row), concise reason, same-day timing
  and what would overturn it. The opportunity is a fundamental assessment window;
  technical entry execution stays with the user. No separate released-today column.
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
  New commentary does not redate its underlying old news. Do not fetch OHLC.
- For today, use the real research cutoff and include only news then available.
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
  and direct `sources`. Include a nonempty `entry_opportunities` array of the
  strongest currencies, with `currency`, `summary`, `starts_at`, `ends_at`,
  `timing_note` and `invalidation`. Both offset-aware window instants must stay
  within the selected Jakarta date, start before end. Today starts at/after the
  research cutoff and ends by 11:59:59 PM Jakarta; narrow timing only with verified
  catalysts. Otherwise explicitly use cutoff through the remaining day, without
  inventing an exact execution minute. Historical windows must use evidence known
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
