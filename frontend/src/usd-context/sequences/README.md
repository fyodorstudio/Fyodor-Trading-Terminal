# Roofs: retained relationship workflow

Roofs is an experimental bottom dock and chart overlay. It retains legacy
relationship calculations/settings; it does not automatically adopt R1 or a newer
standalone family model. Development scope comes from the
[main objective](../../../../fyodor%20trading%20terminal%20main%20objective.md).

| Folder | Responsibility |
| --- | --- |
| `chart/` | Viewport projection, lanes, connections and marker emphasis |
| `core/` | Display/workflow contracts and captured relationship data |
| `audit/` | Captured relationship provenance and replay |
| `storage/` | Saved roof controls and snapshots |
| `ui/` | Overview, selected details and source-release navigation |

Arithmetic and activation rules live in `../../scoring-system/relationships/`.
[USD context](../README.md) supplies retained evidence;
[Raycaster](../../raycaster/README.md) presents the captured selection.

Overview source links open Inspector without changing its filters or date range.
Preserve captured publication clocks, relationship identity, overview scroll and
source corrections. Pan translates cached plans; it does not recalculate history.

[Earlier workflow/display records](../../../../reports/module-history/roofs-through-2026-10-11.md).
