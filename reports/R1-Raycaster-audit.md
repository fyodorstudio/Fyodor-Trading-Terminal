# R1 Raycaster audit — 10 October 2026

Raycaster adds R1 Scoring System. Context, Context-detailed and Selected combo remain available as Retired; Roofs/Candy retain their own engines. The terminal initially opens the R1 view. No scoring weights or magnitude policies changed.

R1 shows separate EUR/USD combined evidence, before/after points and a signed color-coded change. Publication rows use configured icons and display-clock dates without timezone suffixes. Simultaneous publications share one combined delta. Each candle lists its updates; candles without a publication retain the latest dated update. Corrections, schedule changes and expiry are identified separately. Inspector filters do not select R1 inputs.

Verified: all 72 frontend suites, clean lint and production build (existing bundle-size warning).

A background worker builds change-clock snapshots from the shared Inspector snapshot reader. It caches family selection and assessments within publication/observation epochs, including earlier-quarter revisions that change a current comparison. Period metadata is scanned once per relevant captured version; unchanged freshness slots and nominal aggregates are reused. Hover performs a binary lookup, never scoring or history loading. Sensitivity sweeps remain in Inspector's audit and are omitted from this nominal timeline; the displayed direction, strength and missing-evidence interval use the same base formula.

Read-only Elev8-Demo2 replay through 2026-10-10T12:00:00.000Z: 8633 rows, 2 storage pages, 80 known schedules, 7512 timeline clocks. 24 USD/EUR Inspector comparisons pass, including March Claims and September CPI. Cold and warm built-worker output exactly match the pure timeline.

March 19 Claims: USD -17.824807692 → -17.606474359; change 0.218333333. The point is combined currency evidence, not the standalone Claims vote.

Informational terminal timings: query 1651 ms; pure timeline 2262 ms; built worker cold 2274 ms, warm 1677 ms. Initial history preparation is still needed. These samples do not measure browser hover latency.

Regression coverage: simultaneous same-currency publications, different-time publications on one candle, correction clocks, prior-quarter revisions, schedule-known-at admission, expiry, future exclusion, retained update dates, 200 cached snapshots perform zero period, assessment, freshness or combination work; 100 hovers coalesced into one frame, zero hover/display-clock jobs or requests, unchanged-poll identity, actual source correction and settings invalidation, hidden worker/poll/RAF cleanup. Assembled terminal remains included in the frontend suite. Visual verification remains with the user.

## Raycaster presentation refinement — 10 October 2026

Summary slots keep score pairs on one line and retain EUR-first update order.
Each update shows changes in combined points by family plus a total. Changes to
nonpublishing families appear as a relationship adjustment. Display cents add up
to the total without changing raw scoring. The direct currency point gap retains
missing-evidence uncertainty.

Read-only Elev8-Demo2 replay: 8633 rows, 7512
clocks, 24 Inspector comparisons; pure and built-worker outputs match.
Every update conserves raw family changes and reconciled display cents.

September 30 at 21:59 Jakarta: [{"family":"gdp","label":"GDP","change":3.75},{"family":"pce","label":"PCE","change":5.5125},{"label":"Relationship adjustment","change":-4.725}];
combined change 4.5375; USD−EUR gap 15.048772377.

Informational terminal timings: query 1687 ms, pure timeline
2326 ms, built worker cold 2325 ms / warm 1925 ms.
These do not measure browser hover latency.

Regression additions cover contribution conservation, CPI-to-PCE replacement,
comparison gaps and unavailable evidence, fixed mounted summary slots and currency
order. Hover still starts zero scoring work or requests. All 72 frontend suites,
lint and build pass; the existing bundle-size warning remains. Visual review is
left to the user.
