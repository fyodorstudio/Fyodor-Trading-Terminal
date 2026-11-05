# Global risk discovery

Part of every [Assess Trade Now](../.agents/skills/assess-trade-now/SKILL.md)
invocation, including a focused currency refresh. No longer prompt is needed.
Research runs only during the invocation; durable local reminders do not invoke AI.

## Scope and decisions

Review current unresolved risks and the next seven days across all eight currencies,
prioritizing the next 48 hours. Retain a known major later milestone as dated context
when relevant, without expanding every run into an unlimited calendar sweep.
Read the current broker schedule and active external events, then check independent
calendars, official publisher schedules and fresh reporting. Broker completeness
does not establish complete market coverage. Elections, fiscal decisions, Treasury
issuance/buybacks, central-bank speeches and missing publisher releases are useful
examples; inclusion depends on their current relevance, not a fixed indicator tier.

Explain supported transmission through relative yields, policy expectations, risk
appetite, energy/import costs and funding/liquidity. A US event can matter to JPY
without a Japanese release. Global display is a visibility decision, never evidence
of equal impact or identical bias across eight currencies. Keep actual researched
currency/instrument tags; do not add all eight merely to route stars everywhere.
Use currency-specific directional or bullish-if/bearish-if implications. In a
focused refresh, global discovery does not renew unresearched currency news clocks.

Use the shared [tier reference](CURRENCY-DETAILS.md): S — essential, A — major,
B — supporting, C — secondary. Exact calendar series use the shared catalog;
external risks need a sourced occurrence-specific tier. Only newly confirmed S
occurrences are candidates for automatic curation. A/B/C can be saved/shown
without automatically arming them. Preserve every existing reminder choice.
Volatility is possible, not assured; do not invent probabilities or predict a spike.
Fundamentals are the agent's role. Even "JPYX near resistance: breakout or reverse?"
calls for fundamental continuation/invalidation evidence and upcoming catalysts,
not technical levels, price scans, entries, stops or automatic pair selection.

## Discovery and evidence

Start a receipt and read its compact result:

```powershell
pnpm analyst discovery start --broker Pepperstone-Demo --scope <scope> --output tmp/<unique-run>
```

Its local
external/upcoming snapshots cover all currencies even when the news scope is narrow.
Follow all pages. Two global web families, `global-risk-schedule` and
`global-ongoing-risk-news`, supplement the requested currency's source checks.
Check imminent risks promptly, then continue the fundamental research. The receipt
is evidence of work performed, not proof that no other event can move markets.

Open decisive source bodies, preferring official schedules/numbers and original
reporting. Verify date, timezone/DST, stage and actual retrieval clock. Corroborate
credible alternate schedules when the publisher is unavailable and name that gap.
Do not use search snippets, an old actual, forecast or an elapsed deadline as proof
of fresh publication. Save evidence under the ignored receipt directory and use
`discovery record` incrementally; `--help` describes its source/evidence arguments.
Record candidates with stage, source IDs, inclusion/exclusion reason and pin
read-back. A global candidate outside the news scope also needs
`visibility_scope: "global"` and a supported `cross_currency_note` in the receipt.
Finish/validate the receipt, reporting unavailable coverage explicitly. Reconcile
existing events rather than routinely opening full raw research archives.

## Save global events without inventing clocks

Use [External Sources](EXTERNAL-SOURCES.md) and its runtime preflight. The actual
request schema is `ExternalRequest` in `storage/external_sources.py`.

- Set `visibility_scope: "global"` for custom events admitted to this watch.
  Legacy records default to scoped visibility. Keep their real currency tags.
- Verified exact release: `kind: "scheduled"`, `status: "confirmed"`, and
  offset-aware `event_at`. Decision, conference, operation start/close and result
  publication can be different stages; verify each material stage independently.
- Known date only: preserve `event_date`, leave `event_at` null. The day-level star
  cannot supply an intraday alarm.
- Ongoing unpredictable updates: use `risk_status: "ongoing"` with actual
  `risk_checked_utc`. A known dated event/headline can retain its dated star while
  its current ongoing notice remains visible after that milestone. A completely
  untimed `kind: "watch"` has neither event clock and displays only the notice.
  Election polling milestones do not establish a result-projection timetable.
- Revisit ongoing notices on each invocation. Mark `risk_status: "resolved"`
  only when supported by evidence, with a new check clock. Preserve dated history;
  a past scheduled hour alone does not prove the risk ended. Missing fresh coverage
  leaves the prior dated assessment visible and must be disclosed.

Use a stable key for each development/occurrence and optimistic `expected_version`
for corrections. New records can set `show_on_chart: true`; ordinary updates
preserve the existing chart request ID and later user hides. Do not re-request
visibility merely to defeat a user's hide. Preserve archive choices unless
explicitly asked to restore. A material follow-up retains distinct dated news.
Recurring releases get individually verified occurrences; never blindly repeat
a monthly date, official hour, forecast or prior actual.

When the broker already covers an occurrence, reuse its exact value IDs and current
stage. If a global custom context/star is needed, link `calendar_reference` to the
complete matching broker package. Preserve raw broker observations. Read back the
external version, global visibility, dates and chart request through the running
API before claiming delivery. Dated stars obey the existing chart clock profiles;
an unavailable historical profile never justifies guessing an offset.

## Reminders

The skill has standing permission to select new confirmed S — essential reminders.
News save calls themselves still have no alarm side effects. Chat-only/read-only/no-save
requests suppress event, impact, marker and reminder writes.

Read `GET http://127.0.0.1:8003/alarms` and inspect only relevant future events/jobs,
settings, revision and health. `explicit_choice: false` is an off choice; null means no explicit override.
Always read selected/armed separately, since inherited choices may be enabled. Preserve all existing off choices, global pause, audio and lead
time. Save a sourced occurrence-specific S tier assessment through
`pnpm analyst impact save --input tmp/<rating>.json`; see
[the impact contract](HIGHLIGHT-JOURNAL.md#ai-impact-in-alert).

For eligible known keys use `POST /alarms` with:

```json
{"action":"curate","expected_revision":123,"keys":["external:verified-event-key"]}
```

Use the freshly read revision. This action only selects confirmed future events
and preserves explicit off choices atomically. It does not change global settings.
After a revision conflict, reread/reconcile rather than blindly retrying.

An uncovered broker package can be registered with `subscribe`, using exact
`broker`, complete `value_ids`, descriptive `title`, `enabled: true`, and the
fresh `expected_revision`. First check the current schedule for the same package
and off choices. For a linked external record, curate the broker package only;
do not select a second external reminder for the same occurrence. Unrelated
simultaneous releases retain their own identities. Never alarm a headline, an
ongoing notice, an uncertain hour, a resolved risk or an elapsed stage.

Read back selected/armed state and a pending job at release minus the preserved
offset; job `due` is Unix seconds while event `at` is milliseconds. Verify worker
health and source eligibility. Selected during global pause is not armed. Report
off choices, unsupported timing and runtime failures accurately. Under repository
standing permission, restart this checkout's outdated services if necessary;
preserve stored observations, alarm history and choices. Leave UI/sound acceptance
to the user. No new background AI monitor or price alert follows.

Lead the chat result with event, Jakarta date/time (or uncertainty), supported
cross-currency risk and verified star/alarm status. Saved notification prompts
invoke [One Minute Before Release](../.agents/skills/one-minute-before-release/SKILL.md)
when the user returns; reuse preparation and user-specified pair context, never
automatically choose a pair.
