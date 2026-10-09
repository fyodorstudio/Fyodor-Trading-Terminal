# Fundamental Settings

The chart gear opens the **Fundamental Settings** bottom dock. Scoring System,
Raycaster, Roofs and Candy each have a section. The existing global Settings
button still owns application settings. Settings persist through workspace export
and import; the new Claims models have separate keys from Claims v2.

Scoring System is the canonical USD methodology/calibration page. Definitions
come from `../scoring-system/`. Claims offers independent weekly/trend weights,
manual magnitude overrides, selected-release preview, Apply and Reset to defaults.
Draft changes do not alter Inspector until applied. Other USD families retain
their existing magnitude controls. Raw A−P boundaries stay in Scatter.

Inspector retains its existing standalone views and a link to the selected
model's explanation. Raycaster, Roofs and Candy retain their current controls and
calculations; Raycaster development is deferred. Outside events remain accessible
from their settings sections.

`runtime/settings-navigation.ts` opens the dock without coupling Inspector to its
UI. `runtime/inspection-session.ts` is a transient UI channel, with no fetch or
calculation ownership. Raycaster publishes its held chart window while its tool
settings are open; outside-event defaults use that window or the current chart
hour. Ordinary hover does not invalidate the shell.

Opening methodology without a selected Claims release performs no history fetch
or scoring. Preview uses the same scoped background calculation as Inspector.
Visual audits remain user-owned.
