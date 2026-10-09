# Repository navigation

- Start with [the repository map](docs/REPOSITORY-MAP.md) for terminology, ownership and active versus historical documentation.
- Standalone scoring development does not migrate Roofs/Raycaster/Candy automatically. Claims v3 standalone and their Claims v2 context are separate models/settings.

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

# UI copy discipline

- Every visible sentence must help the user understand the result or take a useful action. Accuracy alone is insufficient justification for putting it on screen.
- Reduce reading and interpretation burden. Lead with the result and its strength, or a concise explanation when no directional output is supported.
- Use the shortest explanation that does the job. Do not repeat the same conclusion or limitation across badges, headings, panels and footnotes.
- Keep calculation rules, feed limitations, provenance and safeguards against duplicate votes in the implementation or optional audit details unless they are necessary to understand the current result.
- Do not add paragraphs, disclaimers, technical metadata or instructions merely to demonstrate correctness or completeness. Keep meaningful uncertainty and unavailable-data states clear and brief.
- Use existing navigation instead of adding redundant buttons or explaining navigation in the reading flow.
- For a rate hold, a sufficient primary explanation is: **Rate held at 3.75%. A hold alone does not establish currency strength or weakness.** Actual/Previous/Change can supply the supporting numbers; separate paragraphs about unavailable guidance, stored rate paths and extra votes are unnecessary in the primary view.

# Repository hygiene

- If shorter explanation or code does the job, do not repeat or overexplain it.
- Reuse existing helpers and keep behavior-preserving simplifications direct; avoid abstractions that add more machinery than they remove.
- Keep active documentation concise and link to canonical contracts. Preserve historical reports and user research notes as evidence.
