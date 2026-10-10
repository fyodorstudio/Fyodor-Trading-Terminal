# R1 scope, quarterly GDP and loading refinement

Read-only Elev8-Demo2 inventory through 2026-10-10T12:00:00.000Z. No collection, database writes, browser automation or price fitting.

- Inspector visibility filters no longer select relationship inputs. USD/EUR model settings retain their own explicit scopes.
- Inspector shows the other currency's combined evidence directly, not a EURUSD pair balance or pair interval. Both currencies keep the same selected clock.
- USD-GDP-R1.1 keeps GDP q/q as its only voting input. Quarterly momentum/revision comparisons remain separate; automatic magnitude now requires 24 earlier comparisons of the matching stage, consistent with the EUR quarterly minimum. This minimum is a design policy, not a proven market coefficient. Existing manual and compatible raw bands retain priority.
- July 30 GDP: Actual 1.5, comparison 2.1, delta -0.6 pp; 45 prior momentum samples; boundaries 1.5 / 3.2 / 27.9 pp; raw evidence -100; direction weakening. Inspector/Scatter parity and removal of future inventory pass.
- Loaded versioned history uses a stable quarter horizon; vintages, calibration and schedules still admit information at the selected publication clock. Reopening reuses snapshots only after exact source revision/coverage validation. Snapshots are bounded to four queries; weak history/feature caches disappear when their source arrays are released.
- Deterministic mounted tests verify zero history requests when moving between loaded publications or reopening unchanged data, zero scoring jobs from visibility filters, applied manual bands and genuine correction propagation. Source-read checks prove history/feature reuse avoids repeated extraction. The built worker passes cold/warm equality and correction invalidation.

## Terminal timing sample

8633 rows across 2 storage pages. Storage queries: 1642 ms. Built worker round trips including startup/serialization: cold 837 ms; reused history 518 ms; changed data 785 ms. These are informational samples, not browser latency guarantees. Initial history fetch remains necessary; visual/browser review stays with the user.

The GDP calibration fix can change historical overall evidence wherever quarterly momentum was previously unknown. Earlier reports retain their dated outputs. Other USD magnitude algorithms, family weights, manual settings and legacy models are unchanged.

Verification for this refinement: all 71 frontend suites pass, including the assembled terminal; lint is clean and the production build passes with the existing bundle-size warning. No visual/browser audit was performed.
