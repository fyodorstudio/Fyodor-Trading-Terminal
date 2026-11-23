# News Flow frontend

The chart-header newspaper button opens the right panel. Extended View has
provider tabs and Settings. The desktop reader and separate phone entry share
models, classification results and server-backed notification settings.

## Modules

| Module | Responsibility |
| --- | --- |
| `NewsFlowPanel.tsx`, `useNewsFlow.ts` | Desktop panel and reader requests |
| `NewsGlobalSettings.tsx` | Keywords, colours and global controls |
| `NewsAutomaticFilters.tsx`, `filter-policy.ts` | Optional filters and overrides |
| `model.ts`, `settings.ts`, `date-range.ts` | Validation, preferences and dates |
| `provider-groups.ts` | Publisher groups and provider selection |
| `NewsCopy.tsx` | Rolling headline/link export |
| `NewsFetchDiagnostics.tsx` | Provider check summaries |
| `NewsAlarm.tsx`, `alert-profile.ts` | Shared alert settings and phone setup |
| `NewsSoundAlerts.tsx`, `sound.ts` | Desktop sounds and arrival processing |
| `NewsPopupSettings.tsx`, `browser-notifications.ts` | Optional browser notifications |
| `mobile/` | Phone reader, built to `dist-news` |

## Reader behavior

The Priority 1, Priority 2 and Excluded checkboxes can be combined. Selecting all
three shows every tier. Priority 1 holds strict catalysts and manual stars.
Priority 2 holds other relevant context and research. The frontend uses the
backend classification for labels, colours and filtering.
[Filter rules](../../../storage/news_flow/RELEVANCE.md) describe the shared
classifier. `relevance.json` supplies tag defaults and aliases.

Provider, date, classification and text search apply before server pagination and
copying. Copy exports headlines and links across all matching pages for a rolling
window. Related providers share group checkboxes. Hiding a provider changes the
combined reader and alerts without pausing its collection.

Tags support Enter/comma, multi-term paste, suggestions and removal. Global
settings keep Include/Exclude separate from automatic filters. The headline
checker previews the backend classifier. Changing rules cancels stale requests.

Sorting supports newest/oldest publication or collection time. Date scopes, copy
windows and Wildcard drafts use publication time, falling back to first collection
for missing/future dates. Relative ages update independently of feed responses.
Add Wildcard opens the existing manual editor in `frontend/src/wildcards/`.

## Alerts and phone

The bell and Global settings share Off / Priority 1 only / Priority 1 + Priority 2 /
All and publication-age controls. Priority 1-only selects the same filtered arrivals
for desktop sounds, popups and phone delivery.
Provider and keyword changes synchronize to storage. Desktop sounds, browser
popup permission and phone setup have their own controls. Startup loads and
historical imports stay silent; blocked sounds can recover after a user gesture
for up to one minute. Old alerts do not replay when settings change.

Desktop sounds and popups need the terminal page open. Browser popup permission
is requested from the enable button. Android delivery runs in storage after the
browser closes. Phone provider filters are device-local; classification rules
come from the shared profile. See [phone setup](../../../storage/news_flow/PHONE.md).

## Tests

```powershell
pnpm --dir frontend test -- test_news_flow test_news_controls test_news_phone test_news_diagnostics test_news_relevance
```

Visual verification is a manual user check.
