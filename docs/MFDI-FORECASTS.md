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

Historical forecasts connect in the saved series colour: solid lines at 60%
opacity, with hollow radius-6 dots around radius-4 actuals so equal values remain
distinguishable. The F switch controls this historical forecast layer.

Upcoming releases replace vertical schedule lines with compact rounded value
dots. They show the captured forecast with 15% fill and 45% outline opacity,
readable text, and a connection from the latest actual at 25% opacity. As the
schedule markers did, these release previews remain visible with F off and follow
the series eye/dot choices. Missing forecasts break connections. Lane view can
place a dash on its row; numerical view omits a marker with no known height.
Verified units/digits are preserved; zero and negative forecasts remain values.

A preview already displayed in the open pane stays pending if release time has
passed but the actual is not available yet. An observed actual at the exact
publication replaces its forecast value and turns the dot solid. The actual uses
its containing candle and real value, including revisions, and clicking anywhere
inside its value dot opens its exact Inspector package. Existing historical N
labels remain unchanged; promoted value dots do not duplicate a label above them.
Marker state follows pair/timeframe changes in the open pane and is cleared when
the broker/source changes or the pane is removed.

The overlay projects on the existing 90-day future axis without adding native
series, timestamps or autoscale contributions. Colour, widths, eye/F changes,
scrolling, backfill and timeframe switches preserve native data and bound scales.
Forecast rings do not add release-selection targets; actual-dot clicks retain the
existing exact Inspector package selection.

Every actual release dot has an anchored card with its name, Actual / Forecast /
Previous and release date/time in the app clock. The Fed Forecast column uses the
exact saved Investing.com consensus when available; an explicitly blank saved
consensus stays blank. Previous uses the supplied previous field, not another
plotted dot. Cards omit retrieval/backfill text, surprise labels and CME probabilities.
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
