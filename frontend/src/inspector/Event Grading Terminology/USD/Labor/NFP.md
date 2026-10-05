# USD · Labor / wages · Jobs report / NFP

Reading convention: **`nfp-vs-previous-v1`**.
Directional score: **`nfp-eurusd-primary-signed-magnitude-v1`**.

## Agreed scoring baseline

Scope is Inspector family `jobs`, country `US`, currency `USD`, in EURUSD.
Compare Actual with supplied Previous, using Inspector's exact raw-integer
arithmetic when available. Forecast and Revised Previous do not enter this score.

Only three primary readings contribute to the signed USD total. Each has series
coefficient 1 and contributes signed magnitude points: Unchanged 0, Small 1,
Medium 2, Large 3, Extreme 4. These coefficients and favorable directions are
application conventions, not measured market sensitivities.

| Event ID | Reading | Role | Favorable A−P direction |
| --- | --- | --- | --- |
| `840030016` | Nonfarm Payrolls | Primary: job creation | Higher |
| `840030015` | Unemployment Rate | Primary: labor-market slack | Lower |
| `840030018` | Average Hourly Earnings m/m | Primary: wage momentum | Higher |
| `840030019` | Average Hourly Earnings y/y | Supporting: annual wage trend | Higher |
| `840030017` | Participation Rate | Supporting: unemployment context | Higher, simplified convention |
| `840030020` | Average Weekly Hours | Supporting: labor usage | Higher |
| `840030023` | Private Nonfarm Payrolls | Supporting: payroll composition | Higher |
| `840030022` | Government Payrolls | Supporting: payroll composition | Higher |
| `840030032` | Manufacturing Payrolls | Supporting: sector detail | Higher |
| `840030024` | U6 Unemployment Rate | Supporting: broader underutilization | Lower |

Nonzero favorable changes receive positive points (green); unfavorable changes
receive negative points (red). For unemployment and U6, falling rates therefore
receive positive points despite negative raw A−P. Exact zero is Unchanged (gray).
Native delta units are thousands of jobs (k), percentage points (pp), and hours (h).
Payrolls accept source unit 0 or 4 with multiplier 1; rates require unit 1 with
multiplier 0, and hours require unit 3 with multiplier 0. No implicit conversion
of incompatible metadata is permitted.

## Primary direction and cancellation

Sum the three primary signed contributions, ranging from −12 to +12:

- Positive USD total → **EURUSD Short** (red badge).
- Negative USD total → **EURUSD Long** (green badge).
- Exact cancellation with nonzero contributions → use the first nonzero primary
  score in this order: **Nonfarm Payrolls → Unemployment Rate → Earnings m/m**.
  Display the deciding series and signed points without altering the zero total.
- All three unchanged → **Uncomputed**. No previous direction is carried forward.
- Undefined, absent, missing, duplicate, unavailable or incompatible primary
  reading → **Uncomputed**, with the affected row's explicit status.

Exactly one usable Actual/Previous reading and frozen manual configuration is
required for each primary series. An unconfigured zero also stays Undefined.
Supporting/unknown rows never contribute, gate completeness, or break a tie.
Missing supporting rows do not prevent direction from the three usable primaries.
Manual limits classify current readings without depending on history frequencies;
partial history remains labeled and does not invent a different threshold.

This replaces the former ten-reading majority badge and Good/Bad size-count
summary. There is no Neutral/Mixed output or arbitrary carry-forward direction.
The raw reading grades and individual histories remain available for all ten.

## Supporting table and role tooltips

Show seven supporting rows in a separate signed 0–4 magnitude matrix. Their
points describe the existing favorable-direction conventions only. The heading
and footer explicitly identify supporting readings as excluded from the USD
total; this table has no independent pair direction or combined score.

Short series-label tooltips explain each primary contribution or supporting role:

- Payrolls: broad monthly job creation.
- Unemployment: labor-market slack; lower is positive under the chosen convention.
- Earnings m/m: latest monthly wage-growth momentum.
- Earnings y/y: annual wage trend, kept separate to avoid a second wage contribution.
- Participation: context for unemployment; its direction alone is ambiguous.
- Hours: labor usage beyond job counts, used as supporting corroboration.
- Private/government payrolls: components already present in total payrolls.
- Manufacturing: sector detail already present in private and total payrolls.
- U6: broader underutilization, overlapping with the unemployment contribution.

Tooltips retain keyboard focus and accessible role descriptions. Supporting
missing/Undefined states remain visible; they are never interpreted as zero.

## Illustrative manual-boundary example

Using the previously inspected October 2, 2026 values, with illustrative manual
limits (not defaults and not a replacement for the user's saved configuration):

| Primary | Actual | Previous | A−P | Small / Medium / Large limits | Points |
| --- | ---: | ---: | ---: | --- | ---: |
| Payrolls | 29k | 162k | −133k | 100 / 200 / 300k | −2 |
| Unemployment | 4.2% | 4.1% | +0.1 pp | 0.1 / 0.2 / 0.3 pp | −1 |
| Earnings m/m | 0.1% | 0.3% | −0.2 pp | 0.1 / 0.2 / 0.3 pp | −2 |

Total **−5 → EURUSD Long** under this agreed rule. Payroll Actual +29k still
means job growth; its negative A−P means fewer jobs added than supplied Previous.
Revised Previous remains separately displayed. The seven supporting readings do
not change this total.

## Magnitude and history contract

Each of all ten series independently stores Undefined or three frozen manual
limits, satisfying `0 < Small < Medium < Large`. Limits mirror across signs;
inclusive decimal ties remain in the lower category; above Large is Extreme.
Freeze saves/locks values. Unfreeze opens editing; valid drafts preview Scatter
bands and size while Inspector uses the saved tuple until Freeze. Existing saved
settings and colors survive this scoring revision. P95 remains retired.

The reference dataset contains all unique, compatible, usable observed readings
released from January 2015 through now, selected broker only, including selected
and newer publications. Earlier / All (e.g. `2 / 140`) distinguishes chronology
from calculation N. New usable releases grow N; corrections replace samples.
Scheduled, missing, duplicate, incompatible, withdrawn or uncertain rows stay
outside N. Manual boundaries remain fixed as history grows.

Seven histogram bins cover three negative ranges, exact zero and three positive
ranges. Extreme values remain in N and use an edge marker beyond the seven bars.
Undefined cells are empty. The shared classifier and saved series limits power
histograms, scatter guides and both NFP matrices.
See [shared magnitude behavior](../../../magnitude/README.md).

## Sources and interpretation

- [BLS Employment Situation technical notes](https://www.bls.gov/news.release/empsit.tn.htm): payroll jobs, hours, earnings and household-survey distinctions.
- [BLS labor-force definitions](https://www.bls.gov/cps/definitions.htm): participation, unemployment and U6.
- [BLS payroll industry table](https://www.bls.gov/news.release/empsit.t17.htm): total, private, government and manufacturing overlap.

Participation can change unemployment without corresponding job creation.
Wage measures share a wage base; payroll components share the headline total.
The chosen three-primary selection reduces repeated contributions but is not a
claim of statistical independence or a universal institutional weighting model.
Institutional priorities can change with economic conditions. Direction describes
this A−P rule; it does not establish a realized price reaction or holding period.

New families require explicit IDs, native-unit contracts, favorable directions,
primary/supporting roles, completeness and tie priority. Changes to NFP's scoring
contract require a new version, updated documentation and regression tests.
