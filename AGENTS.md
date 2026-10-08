# Responsiveness guardrails

- Read `fyodor trading terminal main objective.md` before changing interpretation behavior.
- Keep transient polling status and display clocks local to their consumers.
- Activity appends must not invalidate consumers that only need logging functions.
- Preserve unchanged data identities and stable callbacks across polling updates.
- Hidden panels must avoid expensive presentation work while retaining view state.
- Pan/hover must not rescore history or launch calculation workers.
- Batch viewport work by animation frame; project only relevant visible data.
- Cancel timers, frames, subscriptions and drag listeners on unmount; ignore stale asynchronous replies.
- Performance fixes require a reproducer and deterministic work-count regression.
- Test the assembled terminal as well as individual components; verify genuine data changes, corrections, paging, and timing still propagate.
- Run affected frontend suites sequentially (`pnpm --dir frontend test`); use lint/build for implementation changes.
- Leave visual audits to the user. Do not use computer-use, browser automation, or screenshot inspection unless explicitly requested; report unverified browser performance honestly.
