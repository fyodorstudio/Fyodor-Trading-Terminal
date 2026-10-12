"""Unfiltered calendar evidence, saved outside the live inventory."""
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
import csv
import io
import re

from fastapi import HTTPException
from pydantic import Field, model_validator

from .contracts import Payload
from .currencies import CURRENCIES
from .calendar_clock import project, publication_time_known

DAY = 86400
REPORT_DIRECTORY = Path(__file__).resolve().parents[1] / "Market Analyst Workflow" / "report"


class ResearchRequest(Payload):
    source_id: str = Field(min_length=1, max_length=160)
    title: str = Field(min_length=1, max_length=120)
    scope: str = Field(pattern=r"^[A-Z]{3}([A-Z]{3})?$")
    kind: str = Field(pattern=r"^(historical|upcoming)$")
    from_date: date
    to_date: date
    from_utc_ms: int = Field(ge=0)
    to_utc_ms: int = Field(ge=0)
    timezone: str = Field(min_length=1, max_length=100)
    context_days: int = Field(default=90, ge=0, le=365)
    question: str = Field(default="", max_length=4000)
    focus: str = Field(default="", max_length=500)
    focus_ids: list[str] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def interval(self):
        currencies = [self.scope[:3]] + ([self.scope[3:]] if len(self.scope) == 6 else [])
        if any(item not in CURRENCIES for item in currencies) or len(set(currencies)) != len(currencies):
            raise ValueError("Choose a supported currency or pair")
        if not self.title.strip() or self.from_date > self.to_date or self.from_utc_ms >= self.to_utc_ms:
            raise ValueError("Choose a report name and valid dates")
        days = (self.to_date - self.from_date).days + 1
        if days > 3660 or abs((self.to_utc_ms - self.from_utc_ms) / 1000 - days * DAY) > DAY:
            raise ValueError("Date boundaries do not match the selected interval")
        # Input boundaries may differ from UTC by a display-zone offset.
        if abs(self.from_utc_ms / 1000 - datetime.combine(self.from_date, datetime.min.time(), timezone.utc).timestamp()) > DAY:
            raise ValueError("Invalid start date boundary")
        return self


def stamp(seconds):
    return datetime.fromtimestamp(seconds, timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def cell(value):
    return str(value).replace("|", "\\|").replace("\r", " ").replace("\n", " ")


def number(event, field):
    raw = event.get(field + "_raw_scaled_1e6")
    value = event.get(field)
    return Decimal(raw) / 1000000 if raw is not None else Decimal(str(value)) if value is not None else None


def value(event, field):
    amount = number(event, field)
    if amount is None:
        return "—"
    suffix = "%" if event["unit"] == 1 else " h" if event["unit"] == 3 else {1: "k", 2: "M", 3: "B", 4: "T"}.get(event["multiplier"], " pts" if event["unit"] == 0 else "")
    return f"{amount:f}{suffix}"


def delta(event, field):
    actual, reference = number(event, "actual"), number(event, field)
    if actual is None or reference is None:
        return "—"
    difference = actual - reference
    suffix = " pp" if event["unit"] == 1 else " h" if event["unit"] == 3 else {1: "k", 2: "M", 3: "B", 4: "T"}.get(event["multiplier"], " pts" if event["unit"] == 0 else "")
    return f"{difference:+f}{suffix}"


def collect_evidence(store, request):
    currencies = [request.scope[:3]] + ([request.scope[3:]] if len(request.scope) == 6 else [])
    start = request.from_utc_ms / 1000
    end = request.to_utc_ms / 1000
    context_start = start - request.context_days * DAY
    context_date = request.from_date - timedelta(days=request.context_days)
    # Capture-time offsets and uncertain schedules need a conservative raw-clock
    # query. Exact publication instants or source dates determine membership.
    query_start, query_end = max(0, int(context_start) - 2 * DAY), int(end) + 2 * DAY
    selected, context = [], []
    with store.lock:
        source = store.db.execute("SELECT * FROM sources WHERE id=?", (request.source_id,)).fetchone()
        if source is None:
            raise HTTPException(404, "No stored calendar for this broker")
        source = dict(source)
        cursor = {}
        while True:
            page = store.query(request.source_id, query_start, query_end, limit=5000, time_basis="raw", currencies=currencies, **cursor)
            for event in page["events"]:
                release_at, _ = project(request.source_id, event["server_time_seconds"], event["capture_offset_seconds"])
                event = {**event, "release_at": release_at if publication_time_known(event) else None}
                at = event["release_at"]
                if publication_time_known(event) and at is not None:
                    if start <= at / 1000 < end:
                        selected.append(event)
                    elif context_start <= at / 1000 < start:
                        context.append(event)
                else:
                    source_date = datetime.fromtimestamp(event["server_time_seconds"], timezone.utc).date()
                    if request.from_date <= source_date <= request.to_date:
                        selected.append(event)
                    elif context_date <= source_date < request.from_date:
                        context.append(event)
            cursor = page["next_cursor"]
            if cursor is None:
                break
        # Cover both verified display-day instants in their capture clocks and
        # date-only source days. Different capture offsets must not hide gaps.
        offsets = {event["capture_offset_seconds"] for event in selected + context if event["capture_offset_seconds"] is not None}
        if source.get("offset_seconds") is not None:
            offsets.add(source["offset_seconds"])
        source_start = int(datetime.combine(context_date, datetime.min.time(), timezone.utc).timestamp())
        source_end = int(datetime.combine(request.to_date, datetime.min.time(), timezone.utc).timestamp()) + DAY
        coverage_start = min([source_start, *[int(context_start) + offset for offset in offsets]])
        coverage_end = max([source_end, *[int(end) + offset for offset in offsets]])
        coverage = store.query(request.source_id, max(0, coverage_start), coverage_end, limit=1, currencies=currencies)["coverage"]
        revision = page["revision"]
    sort_key = lambda event: (event["release_at"] / 1000 if publication_time_known(event) and event["release_at"] is not None else event["server_time_seconds"], event["currency"], event["value_id"])
    return sorted(selected, key=sort_key), sorted(context, key=sort_key), coverage, revision


def evidence_row(event, section):
    known = publication_time_known(event) and event["release_at"] is not None
    return {"section": section,
        "time": stamp(event["release_at"] / 1000) if known else stamp(event["server_time_seconds"])[:10] + " (source date; hour unverified)",
        "currency": event["currency"], "country": event["country_code"], "name": event["name"] or event["event_code"],
        "period": stamp(event["period_seconds"])[:10] if event["period_seconds"] else "—", "importance": event["importance"],
        **{field: value(event, field) for field in ("actual", "forecast", "previous", "revised_previous")},
        "actual_minus_forecast": delta(event, "forecast"), "actual_minus_previous": delta(event, "previous"),
        "revision": event["revision"], "event_id": event["event_id"], "value_id": event["value_id"],
        "captured_utc": stamp(event["observed_at"]), "timing_basis": event["timing_basis"] or "unverified",
        "availability": event["availability"], "server_time_seconds": event["server_time_seconds"],
        "capture_offset_seconds": event["capture_offset_seconds"], "time_mode": event["time_mode"]}


EVIDENCE_FIELDS = ("section", "time", "currency", "country", "name", "period", "importance", "actual", "forecast",
    "previous", "revised_previous", "actual_minus_forecast", "actual_minus_previous", "revision", "event_id", "value_id",
    "captured_utc", "timing_basis", "availability", "server_time_seconds", "capture_offset_seconds", "time_mode")


def evidence_tsv(selected, context):
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=EVIDENCE_FIELDS, delimiter="\t", lineterminator="\n")
    writer.writeheader()
    for section, events in (("selected", selected), ("context", context)):
        writer.writerows(evidence_row(event, section) for event in events)
    return output.getvalue()


def release_index(events):
    if not events:
        return "No stored releases in this interval."
    days = {}
    for event in events:
        row = evidence_row(event, "selected")
        key = (row["time"][:10], row["currency"])
        counts = days.setdefault(key, [0, 0])
        counts[0] += 1
        counts[1] += number(event, "actual") is not None
    return "\n".join(["| UTC / source date | Currency | Readings | With actuals |", "|---|---|---|---|",
        *[f"| {day} | {currency} | {counts[0]} | {counts[1]} |" for (day, currency), counts in sorted(days.items())]])


def create_report_folder(directory, title, generated=None):
    directory = Path(directory)
    if directory.is_symlink():
        raise HTTPException(409, "Report directory must be a local folder")
    directory = directory.resolve()
    directory.mkdir(parents=True, exist_ok=True)
    generated = generated or datetime.now(timezone.utc)
    slug = re.sub(r"[^\w-]+", "-", title.strip(), flags=re.UNICODE).strip("-_")[:80] or "research"
    folder = directory / f"{slug}-{generated.strftime('%Y%m%d-%H%M%S-%f')}"
    folder.mkdir()  # Exclusive creation; never reuse or overwrite another report.
    return folder


def save_report(store, request, directory=REPORT_DIRECTORY):
    selected, context, coverage, revision = collect_evidence(store, request)
    generated = datetime.now(timezone.utc)
    gaps = [f"- {currency}: " + ", ".join(f"{stamp(a)} to {stamp(b)} (raw broker clock)" for a, b in item["missing"])
            for currency, item in coverage.items() if item["missing"]]
    text = f"# {cell(request.title.strip())}\n\n" + "\n".join([
        f"- Scope: {request.scope} · {request.kind}",
        f"- Selected dates: {request.from_date} through {request.to_date}, inclusive · {request.timezone}",
        f"- Selected UTC interval: {stamp(request.from_utc_ms / 1000)} ≤ release < {stamp(request.to_utc_ms / 1000)}",
        f"- Broker: {request.source_id} · snapshot revision: {revision}",
        f"- Exported UTC: {generated.isoformat(timespec='seconds')}",
        f"- Selected readings: {len(selected)} · preceding context readings: {len(context)} ({request.context_days} days)",
        "- Scope includes all stored series, regardless of Inspector or Alert filters. Numerical variants are evidence, not independent currency votes.",
    ]) + "\n\n"
    if request.focus:
        text += f"## Focus\n\n{cell(request.focus)}\n\nEvent IDs: {', '.join(map(cell, request.focus_ids))}\n\n"
    text += "## Research question\n\n" + (request.question.strip() or (
        "Research current expectations and the macroeconomic backdrop. Explain conditional outcomes relative to expectations; do not invent unreleased actuals."
        if request.kind == "upcoming" else "Explain the currency move and assess each currency separately. Identify the dominant drivers, changes through the interval, and meaningful counterevidence.")) + "\n\n"
    text += "## Evidence limits\n\nLatest stored observations; capture time is not proof these figures were known on the release date. Preserve revisions and verify contemporaneous figures against web sources. Blank values remain unavailable. Broker forecasts and web surveys can differ in provider, sample, methodology and capture time; keep them separately attributed. A difference alone does not establish an error. Speeches and statements identify scheduled events, not their contents. Off-calendar news, policy expectations, yields and price reactions require external research or OHLC evidence. Date-only schedules retain their source date. A−F and A−P are numerical differences, not strength scores; percentage differences use pp.\n\n"
    text += "Coverage includes the context interval. Missing ranges use the broker's raw clock:\n\n" + ("\n".join(gaps) if gaps else "No recorded coverage gaps in the requested interval.") + "\n\n"
    text += "## Selected interval index\n\n" + release_index(selected) + "\n\n"
    if request.context_days:
        text += "## Preceding context index\n\n" + release_index(context) + "\n\n"
    folder = create_report_folder(directory, request.title, generated)
    filename = "brief.md"
    path = folder / filename
    evidence_path = folder / "evidence.tsv"
    text += f"## Complete evidence\n\nEvidence file: {evidence_path.name}\n\nAll {len(selected) + len(context)} readings are in [{evidence_path.name}](<{evidence_path.name}>), including every series and the separate context section. The index is navigation, not a selection of important events. Read the brief first; query the TSV with `pnpm analyst report \"{folder.name}/{filename}\" --match \"CPI|Interest Rate\"`. Existing full-table Markdown reports remain readable.\n"
    created = []
    try:
        with evidence_path.open("x", encoding="utf-8", newline="") as output:
            created.append(evidence_path)
            output.write(evidence_tsv(selected, context))
        with path.open("x", encoding="utf-8", newline="\n") as output:
            created.append(path)
            output.write(text)
    except OSError:
        for item in created:
            item.unlink(missing_ok=True)
        folder.rmdir()
        raise
    return {"filename": filename, "path": str(path), "readings": len(selected), "context_readings": len(context),
            "coverage_incomplete": bool(gaps), "evidence_path": str(evidence_path)}
