# Highlight research journal

Highlight pins, archived investigations, journal versions and saved prompt
templates remain preserved. Alert's **Legacy pins & research** browser exposes
all brokers and active/archived records for read-only inspection. Open a record
to read its dated investigation, original broker, scope, sources, captured
readings, saved prompts and documentation history. New actuals never overwrite
the readings captured with an earlier assessment.

Inspector uses **View in Alert** rather than Pin/Archive. Pin creation/lifecycle,
preparation and research writing remain explicit agent/CLI workflows. Data
limitations retain CLI/API access without a visible Feed notes panel.

For current news, use Assess Trade Now and Currency News. Give the Highlight ID,
broker and date when asking about a saved occurrence. News saves do not pin
releases, change chart markers, journal histories or reminders. Historical price
investigations use the optional historical-research skill. A journal or lifecycle
write requires the corresponding explicit request.

Archive preserves the occurrence, research versions and archive-time readings.
Restore resumes live readings with the same identity. Re-pinning restores an
archived occurrence. Released pins remain until the user requests archive.
Legacy DELETE API calls archive too; current lifecycle writes use POST endpoints.
Active pins have no separate count limit; the file's 10,000-record safeguard
includes archived occurrences, which continue to retain their history.

## Agent navigation

Run from Lite. Reads use the existing read-only calendar transaction, including WAL.

```powershell
pnpm analyst highlights
pnpm analyst highlights --visibility archived
pnpm analyst highlights --visibility all --match CPI
pnpm analyst highlights --highlight-id "<id>" --summary
pnpm analyst journal read "<id>" --broker Elev8-Demo2 --scope EURUSD
pnpm analyst prompt read "<id>" --broker Elev8-Demo2 --scope EURUSD
pnpm analyst limitations --broker Elev8-Demo2
pnpm analyst upcoming --broker Elev8-Demo2 --scope all --days 90 --category policy --category inflation --category labor
pnpm analyst upcoming --broker Elev8-Demo2 --scope AUDUSD --days 14 --family au-labor
pnpm analyst discovery start --broker Elev8-Demo2 --scope EURUSD --output "Market Analyst Workflow/report/<name>"
pnpm analyst discovery validate --input "Market Analyst Workflow/report/<name>/discovery.json"
pnpm analyst external preflight
```

Upcoming groups exact publication windows using the terminal's source-ID family
definitions, includes complete readings, active/archived pin identities and earlier
same-family investigations. It does not score or recommend automatically. Policy
stages remain separate; verify their official schedule. Follow next_offset with
--offset. Unknown IDs remain Other. Missing publisher series still require web
research. --as-of narrows schedule timing, not historical data vintages.

## Prompt-only preparation and limitations

### AI impact in Alert

Alert's **Tier** column shows S — essential, A — major, B — supporting or
C — secondary, using the same currency table as [Detail](CURRENCY-DETAILS.md).
Calendar rows use exact currency/country/series IDs from `config/event-tiers.json`.
External rows use a sourced S/A/B/C assessment on their stable record key, with C
as the secondary fallback. Tier lookup never uses broker importance. Historic
High/Medium/Low assessment bodies remain unchanged, without an automatic mapping
into new tiers. Neither a static tier nor an assessment write changes reminders.
New external assessments use S/A/B/C; routine calendar tier classification needs
no repeated agent write. Agent reasons/sources remain available in Overview.

Agents save ratings only when requested. Both saved-source identities are supported:
An instruction to fill Highlight covers every active broker pin and active External
Source record, with complete pagination, rather than only the recommended shortlist.
Verify coverage against the live dock data route after saving. Preserve existing
assessments unless the reviewed evidence calls for an appended update.

```powershell
pnpm analyst impact read --broker Pepperstone-Demo
pnpm analyst impact save --input "Market Analyst Workflow/report/<report>/impact.json"
```

Input: `source` (`highlight` or `external`), `reference` (exact Highlight ID or stable
external key), `broker` (required for Highlight, empty for external), `level`
(`S`, `A`, `B`, `C`; legacy levels remain accepted for compatibility), `reason`, timezone-aware `as_of_utc`, and `sources`
(JournalSource format; at least one direct web URL). Read first; updates require
`expected_version` equal to the latest assessment ID. Versions live separately in
`Market Analyst Workflow/alert-impact/`, survive archive/restore and leave raw data,
journals and reminders untouched. GET `/api/v1/alert-impact` is read-only and revision
aware. Ratings do not refresh themselves or invoke an agent. Back up this folder
with the research data. Restart calendar storage after installing this endpoint.

When the user wants to defer investigation, save a PromptRequest JSON containing
scope, prepare_prompt and release_prompt. These contain tasks and component/stage
hints, not a macro verdict. Both prompts receive the exact Highlight ID, broker
and current timing context when copied. A later researched journal prompt can
supersede an older template. Templates survive archive/restore.

```powershell
pnpm analyst prompt save "<id>" --broker Elev8-Demo2 --input "<prompt.json>"
pnpm analyst limitations append --broker Elev8-Demo2 --input "<limitation.json>"
```

LimitationRequest contains key (stable slug), currency, kind (missing-release,
schedule-mismatch, unverified-time or data-conflict), title, description, action,
checked_utc and sources. Optional official_schedule/stored_schedule retain the
disagreement; status defaults to open. Append the same key with status resolved
when evidence resolves it. CLI/API reads retain the latest version per
broker/key with source links and verification time. GET `/api/v1/highlight-limitations` retains read-only access.
There are no browser-writing prompt or limitation endpoints.

Prompt and limitation versions live separately under `Market Analyst Workflow/`
in prompts/ and limitations/. They use the same atomic append and metadata lock
as research. Back up these directories alongside pins, journals and reports.
Missing feed occurrences cannot be pinned without broker value IDs; record them
as limitations rather than adding invented calendar observations.

## Append research

When the user requests saved research, prepare a JSON file inside Lite (for example
beside its report). Use JournalRequest fields below, then append through the CLI.
There is no journal-writing HTTP endpoint or editable UI.

```json
{
  "phase": "before",
  "scope": "AUDUSD",
  "as_of_utc": "2026-10-12T14:00:00Z",
  "body": "One or two paragraphs explaining the verified macro backdrop and prior comparable release.",
  "direction": "Mixed/no clear edge",
  "confidence": "Low",
  "counterevidence": "The strongest evidence against the provisional view.",
  "expectations": [
    {"provider": "Broker feed; survey provider unknown", "as_of_utc": "2026-10-11T10:54:14Z", "values": "Attribute the stored forecasts here."}
  ],
  "sources": [
    {"kind": "web", "label": "ABS release", "locator": "https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia/aug-2026", "note": "Explain which fact this supports."}
  ],
  "release_prompt": "An occurrence-specific release-day request, including the prior investigation and the other currency's backdrop.",
  "prior_highlight_ids": [],
  "price_reaction": "",
  "trade_outcome": ""
}
```

Replace the example time, claims, expectations and sources with actual research.
Sources must include web evidence; local sources need an existing absolute file
inside Lite. Preserve each provider separately. Use phase after for post-release
interpretation. Price reaction and user-provided trade outcomes are separate from
fundamental direction. Scope must contain the Highlight currency. Referenced prior
Highlight IDs must exist for the same broker and currency.

```powershell
pnpm analyst journal append "<id>" --broker Elev8-Demo2 --input "<research.json>"
pnpm analyst highlight archive --highlight-id "<id>" --broker Elev8-Demo2
pnpm analyst highlight restore --highlight-id "<id>" --broker Elev8-Demo2
pnpm analyst highlight pin --broker Elev8-Demo2 --input "<pin-request.json>"
```

Pin input uses the existing HighlightRequest: source_id, label, family_id, currency,
value_ids, event_ids and optional join_window_seconds (0–3600). Use IDs from focused
calendar/upcoming evidence. Assess Trade Now supplies standing permission for
material pins/restores in scope; otherwise lifecycle changes need a user request.
Archive remains an explicit user choice. Existing pin IDs and journals survive
re-pinning. Missing or unreliable broker stages use sourced External Sources and
limitations while preserving the raw observations.

Each append creates a new immutable JSON version under
`Market Analyst Workflow/journal/<highlight-id>/<entry-id>.json`. It records the
research as-of time, save time, calendar revision and complete stored reading
snapshot with capture provenance. Those readings are captured at save time (or at
archive time), not reconstructed evidence available at the research-as-of instant.
Verify release-day vintages independently. Optional correction_of names an earlier
entry of the same phase/scope; corrections never rewrite that entry.
New journals, prompt templates and limitations retain a writer-assigned append
index so equal Windows wall clocks cannot reorder versions or reopen a resolved
limitation. Actual save clocks stay unchanged; older files are read without migration.

Version-1 pins remain readable without migration writes; lifecycle mutations
atomically save version 2. Writes use an interprocess metadata lock; a conflict
fails visibly without replacing existing records. Journal changes update the
Highlight revision even when calendar data stays unchanged. Back up the journal
directory, highlights.json and report folders together, separately from calendar
backups. No calendar observations are changed by these commands.
