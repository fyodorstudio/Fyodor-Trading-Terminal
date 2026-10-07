# Fundamental tools UI v1

The header's right-side outlined group contains Raycaster waveform, Roofs
chevrons-up, Candy SVG and one gear. Timeframe/drawing controls remain together.
Header controls toggle saved visibility independently; opening settings changes no
visibility or calculation inputs. The popover has Raycaster, Roofs and Candy tabs,
a shared context-mode selector and Manage outside events. It stays modeless and
restores gear focus on Close/Escape; outside clicks dismiss it. Broker, symbol or
timeframe changes close it without reviving a former scope's panel.

`settings/` contains presentation and existing preference controls. USD/EUR input
editing stays under Advanced settings. Roof density is an optional backwards-
compatible `density` field in `fyodor.context-sequences.v1`, included in workspace
exports and validation. The old chart density buttons, standalone roof guide,
Raycaster box gear/details wrapper and separate chart Outside events + are retired.

`runtime/inspection-session.ts` is a transient UI-only channel. It owns no fetch,
worker or scoring code. The active Raycaster controller publishes its existing
inspection only while the scoped popover is open. Header settings subscribe at
the popover, so ordinary hover never causes Terminal-shell/chart parent renders.
Scope and input/mode signatures reject old readings. The latest inspected candle
is retained while settings are open, matching the former box gear behavior. No
new timeline is requested on open, even when all chart views are hidden; controls
still work, and the breakdown asks for a Raycaster candle inspection.

Outside-event editing uses the existing note store and form, embedded within the
popover. It works with Candy hidden and uses the captured chart window or current
broker-clock hour as a starting range. Highlight clicks can still edit a note on
the chart. Saving annotations affects neither visibility nor numerical output.

Icons use 16px SVG line paths; Candy/ChevronsUp attribution is in
`../../public/third-party-notices.txt` and ship with the build. Existing numerical engine versions and roof display v4 rules
are unchanged. Visual audits remain user-owned.
