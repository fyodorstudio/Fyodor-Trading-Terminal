from __future__ import annotations

from typing import Literal
from decimal import Decimal
import re

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Payload(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class CalendarEvent(Payload):
    value_id: str = Field(min_length=1, max_length=32)
    event_id: str = Field(min_length=1, max_length=32)
    server_time_seconds: int = Field(ge=0)
    period_seconds: int = Field(ge=0)
    revision: int = Field(ge=0)
    currency: Literal["EUR", "USD"]
    country_code: str = Field(min_length=1, max_length=12)
    country_name: str = Field(max_length=160)
    name: str = Field(min_length=1, max_length=500)
    event_code: str = Field(max_length=160)
    importance: Literal["none", "low", "medium", "high"]
    unit: int
    multiplier: int
    digits: int = Field(ge=0, le=16)
    time_mode: int
    impact: Literal["none", "positive", "negative"]
    actual: float | None = None
    forecast: float | None = None
    previous: float | None = None
    revised_previous: float | None = None
    actual_raw_scaled_1e6: str | None = None
    forecast_raw_scaled_1e6: str | None = None
    previous_raw_scaled_1e6: str | None = None
    revised_previous_raw_scaled_1e6: str | None = None

    @model_validator(mode="after")
    def exact_raw_numbers(self):
        for field in ("actual", "forecast", "previous", "revised_previous"):
            raw = getattr(self, field + "_raw_scaled_1e6")
            if raw is not None:
                if not re.fullmatch(r"-?\d{1,19}", raw) or not -(2**63) < int(raw) < 2**63:
                    raise ValueError("Invalid raw MT5 calendar integer")
                setattr(self, field, float(Decimal(raw) / 1000000))
        return self


class PublisherContext(Payload):
    protocol_version: Literal[1]
    publisher_version: Literal["2.0.0", "2.0.1", "2.0.2"]
    source_id: str = Field(min_length=1, max_length=160)
    instance_id: str = Field(min_length=1, max_length=120)
    server_time_seconds: int = Field(ge=1420070400)
    server_utc_offset_seconds: int = Field(ge=-50400, le=50400)


class BackfillChunk(Payload):
    protocol_version: Literal[1]
    job_id: str = Field(pattern=r"^[0-9a-f]{32}$")
    lease_token: str = Field(pattern=r"^[0-9a-f]{32}$")
    chunk_index: int = Field(ge=0, le=10000)
    chunk_count: int = Field(ge=1, le=10000)
    event_count: int = Field(ge=0, le=250000)
    events: list[CalendarEvent] = Field(max_length=250)

    @model_validator(mode="after")
    def valid_index(self):
        if self.chunk_index >= self.chunk_count:
            raise ValueError("chunk_index must be below chunk_count")
        return self


class BackfillFailure(Payload):
    protocol_version: Literal[1]
    job_id: str = Field(pattern=r"^[0-9a-f]{32}$")
    lease_token: str = Field(pattern=r"^[0-9a-f]{32}$")
    error_code: int
