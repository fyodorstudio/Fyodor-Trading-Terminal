---
name: one-minute-before-release
description: "Wait for an imminent economic release in the active chat, reuse prepared Assess Trade Now context, check fresh actuals and promptly return a fundamental decision card. Use when asked to count down or await publication; excludes background scheduling and candle analysis."
---

# One Minute Before Release

Follow AGENTS.md and the relevant instructions from
[Assess Trade Now](../assess-trade-now/SKILL.md), without rereading guidance
already loaded. This is a bounded active-chat countdown, not a background
scheduler, automatic trade or promise of second-level response latency.
The name describes the intended invocation time, not a required start time.
Do not start a wait merely because a general assessment mentions upcoming news.

## Reuse preparation

Resolve the requested occurrence, broker, reference period and pair from the
prompt and prior assessment; an invocation plus event/date is sufficient when
that context resolves the scope. Inherit the Jakarta AM/PM-only presentation
default; use UTC internally, without displaying additional timezones.
Carry forward its sources, policy concerns,
separately attributed forecasts, conditional scenarios, counterevidence,
extreme-move risks and the prepared at-least-seven-day fundamental exit/
reassessment watchlist. Keep their as-of times and refresh schedule changes.
Retain eight-currency context if available, but compare all seven counterparts
only when the user has requested that scope or best-event-pair selection;
otherwise assess the requested pair or candidate list. A subsequently narrowed
candidate list takes precedence. Remember the conditional shortlist and why
each counterpart was selected; fresh actuals can change the winner. Do not repeat
comprehensive research near publication.

If preparation is missing or stale, refresh only decisive gaps. Say when the
coverage cannot be completed before publication; do not claim a full eight-
currency review from a thirty-second preparation. An unsupported counterpart
cannot be selected merely because another currency's release is clear.

## Verify time and wait

- Verify the exact publication instant against the official schedule, reusing
  already verified evidence when still applicable. Separate decision, statement,
  projections and press conference stages. Show the target in Jakarta AM/PM;
  retain the verified UTC instant internally.
  A date-only or unresolved conflicting schedule cannot support a precise timer.
- Read the available clock tool's current UTC time and calculate remaining time
  from that verified instant, rather than reusing an old countdown. Resolve any
  inconsistent client/runtime clocks before claiming a live countdown. If clock
  or wait tools are unavailable, explain the limitation; do not claim to be waiting.
- Announce the target, scope, preparation gaps and stopping deadline. Default to
  five minutes after the targeted publication unless the user specifies another
  bound. If invoked after release, check actuals immediately; do not wait again
  for a past instant. If already beyond the deadline, make one current check and
  report the result without pretending to have observed publication live.
- Use available short, interruptible waits (such as clock.sleep), at most 30
  seconds each, capped by time remaining to the next check or deadline. Re-read
  the clock after waits and tool calls; new user input may end a wait early.
  Use useful commentary about changes or missing actuals at least every minute,
  without narrating unchanged polls. Stop on cancellation or changed scope.
- At publication, query the exact Highlight with --summary, or the focused
  calendar occurrence when no Highlight exists. Read-only CLI queries do not
  refresh the publisher. The storage collector waits two seconds between cycles,
  but broker/publisher arrival can lag; never promise numbers from that interval.
  While decisive actuals remain missing, make focused sequential checks roughly
  5–10 seconds apart, allowing for command duration and backing off on failures.
  Do not busy-loop, query the full inventory or repeatedly reload instructions.

## Fresh actuals, then interpret

Check the exact period, series definitions, units, actuals, revisions and decisive
components against the prepared expectations. A new capture timestamp, elapsed
release time, unchanged value or empty field is not proof of publication; equally,
a genuinely unchanged actual can be valid if current-release evidence confirms
it. Never substitute forecast, previous value or the prior release for today's
actual. Check the release package as a whole, not as a count of bullish fields.

Retrieve the prepared official release endpoint and focused local readings in
parallel where possible. If the official page fails, try one suitable alternative:
fresh broker readings or accessible reliable reporting of the exact release.
Attribute any provisional broker-only assessment and missing official confirmation.
Search snippets alone do not confirm a decisive fact. Material disagreement or
missing decisive fields means wait/no clear edge; identify the unresolved issue.
Do not wait for a slow website if sufficiently verified current evidence already
supports an explicitly attributed interpretation. Do not delay for nondecisive
details or repeatedly search unchanged pages.

Refresh intervening news since preparation, especially simultaneous releases,
changed guidance, intervention and other exceptional risks for the selected pair.
Use a focused check, not a second full macro investigation. Interpret how the
surprise changes the expected policy path; an in-line release need not provide
a new edge. Before-release hypotheses may be confirmed, weakened or overturned.
No candles, saved OHLC, chart inspection or historical reaction calculations.

## Respond and stop

As soon as the evidence supports an interpretation, lead with currency direction,
best-supported pair buy/sell lean (including slight), and confidence, applying
Assess Trade Now's direction and next-opportunity guidance. An in-line package
can retain a weak backdrop lean without creating a new release signal. Return the Assess Trade Now
decision card, including Extreme-move risk, strongest counterevidence, missing
confirmation, invalidation, fundamental holding/exit consideration and the next
verified Jakarta AM/PM news that could challenge the thesis. Reuse the prepared
seven-day watchlist; disclose missing coverage rather than delaying the release
verdict for a new broad review. If the verdict is weak, entry evidence is insufficient,
or actuals remain missing, reuse the prepared next opportunity: name the event,
verified Jakarta AM/PM release time, suggested return time and conditional outcomes.
Do not finish with a bare Wait/No clear edge or promise a bigger move. In requested eight-currency mode, use the prepared overview
to choose the best-supported counterpart, disclose stale/incomplete coverage,
and give only one leading card plus a brief alternative/conflict comparison.
For best-pair selection, lead with "[Pair]: [buy/sell] bias, [confidence], because
[relative fundamental reason]; main reversal risk: [risk]." Compare against the
prepared expectations, not simply whether inflation increased. Separate any
potential-volatility inference from this direction verdict. User-provided
technical alignment does not strengthen the fundamental evidence or preselect
the winning pair. Do not promise a verdict at the exact publication second;
state whether actuals are verified, provisional or still missing.

If decisive evidence remains unavailable at the deadline, report wait/no clear
edge, exactly what is missing/conflicting, last check time and what would allow
reassessment. Finish the active wait; do not silently continue monitoring. Do not
wait for a later policy stage unless it is the requested target or necessary for
the verdict within the agreed bound; name pending stages in Next danger.

No entry price, stop, sizing, profit forecast, candle confirmation, order, service
restart, pin/archive or journal write is implied. Save only when requested.
Creating this skill does not start a timer or create an automation.
