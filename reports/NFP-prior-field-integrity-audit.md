# NFP provider prior-field integrity — 2026-10-06

The December 16, 2025 calendar row contains valid numbers with an invalid implied
revision relationship. This is a source interpretation correction, not a weight
change fitted to the EURUSD chart.

## Official publication versus broker fields

The [archived BLS report](https://www.bls.gov/news.release/archives/empsit_12162025.htm)
published November payroll growth of +64k together with the first October
estimate of -105k. September was revised +119k to +108k (-11k); August was revised
-4k to -26k (-22k). BLS explicitly says there was no October Employment Situation
news release and no October revision in this publication.

Local snapshot: Elev8-Demo2, revision 78432; payroll event `840030016`, value
`276324`, reference month November 2025, UTC publication December 16 at 13:30.
Its `previous` is +119k and `revised_previous` is -105k. The earlier payroll
publication is September's +119k, released November 20; there is no earlier
October payroll record in this inventory.

- Actual minus Previous: 64 - 119 = -55k, November versus the earlier September reading.
- Actual minus provider prior: 64 - (-105) = +169k, November versus October.
- Provider prior minus Previous: -105 - 119 = -224k, **not a same-month revision**.

Do not overwrite -105k with +108k: the broker field contains October's valid
reading, and the contract does not separately retain September's revision here.

## Correction

NFP v2's revision component now requires a unique usable earlier publication for
the immediately preceding reference month. Missing, duplicate or invalid rows,
and simultaneous/future publications, cannot establish that component. This
gate applies to current features and historical magnitude calibration; Scatter,
Raycaster and publication context reuse it. No missing weight is redistributed.

This is a conservative safeguard rather than complete reference-period
provenance: a consecutive record still relies on the provider assigning the
correct prior values, and stored records may contain later revisions.

The payroll readings table uses **Provider prior** and **A−PriorP**, with a tooltip
explaining possible reference-month gaps. Other series retain their existing
labels. Raw values and source storage are unchanged.

## Stored replay

All eight Raycaster families enabled, automatic magnitude settings. The corrected
December 16 NFP total is -0.55 instead of -0.95. Available nominal component
coverage becomes 35% instead of 45%; hiring and wages lack consecutive October
history, and the alleged revision no longer votes. The NFP source still says
EURUSD Long / weak evidence, primarily because unemployment increased.

| Broker day end | Combined EURUSD bias | Evidence | USD total |
| --- | --- | --- | ---: |
| 2025-12-23 | Long | Weak | -0.050757273183 |
| 2025-12-31 | Short | Weak | +0.080304722324 |
| 2026-01-09 | Short | Weak | +0.175385943484 |
| 2026-01-28 | Short | Weak | +0.206774665578 |

The December 23 disagreement and later January rally remain unresolved. Correcting
this revision feature does not make every context output match price. The replay
does not ingest FX returns or identify causes of a price move.

Reproduction from the repository root:

```powershell
node frontend/scripts/usd-context/audit-window.mjs storage/data/usd-menu-v5-design-snapshot.json 2025-12-16 2026-01-28 storage/data/usd-context-revision-integrity-audit
```

This checks six publication-time replays with future events removed and produces
the ignored local JSON/Markdown report. Current inventory snapshots are not
original publication vintages. The earlier v6 design audit predates this
standalone feature correction; its source-parity results describe that earlier
implementation.

Regression coverage includes the skipped-month case, valid consecutive revisions,
missing/duplicate prior readings, simultaneous/future exclusion, raw data
preservation and the updated table labels. Visual review remains with the user.
The complete frontend test suite, lint, TypeScript/Vite production build and
diff whitespace checks passed after the correction.
