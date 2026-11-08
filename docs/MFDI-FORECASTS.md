# MFDI forecasts and Fed consensus

Owner: `frontend/src/market-data/indicators/macro/`, `storage/fed_forecasts.py`.

Each MFDI series has an independently saved **F** forecast toggle; its slash means
hidden. Existing USDX payroll forecasts default on; newly added event series
default off. Currency event selections and styles persist locally and can be
reused on any chart symbol by ticking that event currency in MFDI Inputs. The series
eye hides both actuals and forecasts, preserving the F choice. Style also exposes
the forecast choice with the existing OK/Cancel/Reset draft behavior.

Historical forecast dots use their own captured Forecast field and verified
release/chart clocks, independent of Actual. Fed uses saved Investing.com consensus
at an exact matching release where available, otherwise its captured MT5 forecast;
an explicitly blank saved consensus stays blank. These are latest stored vintages,
not reconstructed release-day consensus. Zero and negative forecasts are valid.

Forecasts connect to forecasts in the saved series colour: historical lines are
solid at 60% opacity, with hollow radius-6 dots around the radius-4 actuals so equal
values remain distinguishable. Upcoming forecasts use 40% opacity and dashed
connections from the last historical forecast. A missing upcoming forecast keeps
only its vertical schedule and breaks the connection. The existing dots setting
also controls forecast rings. No values are inferred for missing forecasts.

The overlay projects on the existing 90-day future axis without adding native
series, timestamps or autoscale contributions. Colour, widths, eye/F changes,
scrolling, backfill and timeframe switches preserve native data and bound scales.
Forecast rings do not add release-selection targets; actual-dot clicks retain the
existing exact Inspector package selection.

The Fed dot tooltip shows consensus values only. It has no actual/date header,
retrieval/backfill text, disclaimers, surprise labels or CME probabilities.
The dashed actual-to-consensus connector and Beat outline remain on the plot;
hover does not change axes or timestamps. Clicking opens the original Inspector
release package.

The local cache contains 56 released decisions from January 2020 through October
2026, imported from the supplied `fed rate.txt` table. It has 54 consensus values;
the two March 2020 emergency decisions have blank forecasts in the source.
Jakarta table timestamps match the stored publication UTC. Raw MT5 data is unchanged.

Existing import: `pnpm storage:fed-forecasts save --input <json-file>`.
Runtime data remains in ignored `storage/data/fed-forecasts/`. The existing schema
and backup support are unchanged. CME probability display is omitted at the user's
request.
