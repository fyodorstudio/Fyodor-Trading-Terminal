# Alert bottom dock

Alert shows MT5 publications for all eight major currencies, independently of
chart pair and Inspector preferences. All currencies and families are initially
enabled; the default horizon is seven days, with 30/60/90-day alternatives.
Currency buttons filter locally without another storage request. Day groups and
publication clocks follow the application's time display.

| File | Responsibility |
| --- | --- |
| `model/alert-preferences.ts` | Global family selections, currency and horizon; `fyodor.alert.preferences.v1`, included in workspace exports |
| `model/alert-episodes.ts` | Catalog series scope, shared release grouping, admission/status transitions and countdowns |
| `dock/AlertDock.tsx` | Active broker query, corrected clock, day groups, coverage and publication rows |
| `dock/AlertFiltersModal.tsx` | One currency pane at a time; draft Save/Cancel using Inspector's shared `FamilyFilterGroups` |

One row represents one grouped publication. Known policy companions retain their
decision anchor; generic speeches remain independent. Exact source IDs determine
family membership. Alert family edits never change chart symbols or pair filters.

Queries use selected series or up to eight currencies from the active broker,
with a day-stable current-day window and the selected future horizon plus grouping
margins. Large/full catalogs use currency scopes to include new MT5 IDs. Admission
then enforces the upcoming window; incomplete historical releases and elapsed
speeches never remain in the queue. Date-only schedules remain on their source
calendar day without a countdown. Withdrawn observations are omitted. Empty
family selections make no requests.

Countdown ticks do not refetch or regroup inventory. The shared storage
hook owns polling, revision-consistent paging, cancellation and outage retention.
Closing Alert stops its clock and query; calendar collection continues in storage.
Dock sizing belongs to workspace-docking's shared height preference.

`tests/alert/test_alert.mjs` covers all currencies, filters, preferences, scoped
requests, clock/timezone behavior, state transitions, rescheduling and cleanup.
Workspace portability and assembled terminal suites cover integration. Visual
layout and live MT5 review belong to the user.
