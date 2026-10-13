# Highlight research journal

Alert's existing bottom dock contains **Highlight → Active / Archive / Discovered Limitations**. Expand a
card for a full-width reading panel. Its View selector contains Before release,
After release, Sources and captured evidence, Research history (version count),
Prompt preview (scope/stage) and Latest broker readings. Header dates, countdowns,
Research and Archive/Restore use aligned columns, with Scope at the far right.
Scope selects the currency/pair's journal and prompt; it does not change the chart.
In Prompt preview, prompt stage and Copy Prompt sit beside the View selector.
The layout adapts to the dock's width. Text is read-only.
Historical studies follow the initial 15 minutes, two-hour checkpoint, remaining
trading day and next 3–5 trading sessions. Intraday extrema, reversals and giveback
are described at candle resolution. The Research Date Range's complete calendar
and dated web evidence identify intervening news for both currencies, including
off-calendar developments; later releases/stages get separate price baselines.
Near-release and after-release prompts also request an after-entry news watchlist:
verified Jakarta/UTC times, material events and outcomes that add volatility,
challenge or invalidate the thesis. Fresh expectations wait until preparation.
Published historical cards use **Research Documentation**, combining the saved
investigation, sources, frozen readings and version history. Preparation views
are greyed out there. An elapsed clock alone does not select this mode: verified
numeric publication or a past saved post-release study is required. Future
cards retain the preparation workflow, including when archived early.
Copy Prompt copies the latest tailored release request for that scope, prefixed
with the occurrence ID, broker and verified UTC time. Without research it uses a
generic verification request. Clipboard failures open the read-only Prompt preview.
Choose **Prepare before release** for same-day/hour-before research, or **Interpret
after release** once actuals arrive. Prompt templates are separate from journal
research; saving a prompt never fills Before release with a pretend investigation.

Archive replaces Unpin/Remove pin in Alert and Inspector. It preserves occurrence
identity, journal files and an archive-time reading snapshot. Restore resumes live
readings with the same identity. Re-pinning an archived occurrence restores it.
Released occurrences stay active until the user archives them. Legacy DELETE API
requests archive too; the new UI uses a dedicated POST endpoint so an older storage
service cannot accidentally delete a pin. Restart storage manually after upgrading
the backend; agent research does not restart services.

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
```

Upcoming groups exact publication windows using the terminal's source-ID family
definitions, includes complete readings, active/archived pin identities and earlier
same-family investigations. It does not score or recommend automatically. Policy
stages remain separate; verify their official schedule. Follow next_offset with
--offset. Unknown IDs remain Other. Missing publisher series still require web
research. --as-of narrows schedule timing, not historical data vintages.

## Prompt-only preparation and limitations

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
when evidence resolves it. The UI shows the latest version per broker/key and
retains the source links and verification time. It is read-only and caches the last
valid records during outages. GET `/api/v1/highlight-limitations` serves this view.
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
calendar/upcoming evidence; explicit user authorization is required for lifecycle
changes. Existing pin IDs and journals survive re-pinning.

Each append creates a new immutable JSON version under
`Market Analyst Workflow/journal/<highlight-id>/<entry-id>.json`. It records the
research as-of time, save time, calendar revision and complete stored reading
snapshot with capture provenance. Those readings are captured at save time (or at
archive time), not reconstructed evidence available at the research-as-of instant.
Verify release-day vintages independently. Optional correction_of names an earlier
entry of the same phase/scope; corrections never rewrite that entry.

Version-1 pins remain readable without migration writes; lifecycle mutations
atomically save version 2. Writes use an interprocess metadata lock; a conflict
fails visibly without replacing existing records. Journal changes update the
Highlight revision even when calendar data stays unchanged. Back up the journal
directory, highlights.json and report folders together, separately from calendar
backups. No calendar observations are changed by these commands.
