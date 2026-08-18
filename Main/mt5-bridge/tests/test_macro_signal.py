from __future__ import annotations

from macro_signal import (
  aggregate_outcomes,
  build_backtest_result,
  build_signal_candidates,
  calculate_atr_by_candle,
  evaluate_candidate,
  get_signal_definition,
  score_event,
  V2_VERSION_ID,
)


def calendar_event(
  event_id: int,
  timestamp: int,
  currency: str,
  title: str,
  actual: str,
  forecast: str,
  previous: str,
  impact: str = "high",
) -> dict:
  return {
    "id": event_id,
    "time": timestamp,
    "countryCode": "EU" if currency == "EUR" else "US",
    "currency": currency,
    "title": title,
    "impact": impact,
    "actual": actual,
    "forecast": forecast,
    "previous": previous,
  }


def candles(count: int = 60, start: int = 0, step: int = 14_400) -> list[dict]:
  rows = []
  close = 1.1000
  for index in range(count):
    open_price = close
    close = open_price + 0.0001
    rows.append({
      "time": start + index * step,
      "open": open_price,
      "high": open_price + 0.0010,
      "low": open_price - 0.0010,
      "close": close,
      "volume": 10,
    })
  return rows


def candidate(direction: str = "long", event_time: int = 14_400 * 20 + 1) -> dict:
  return {
    "eventTime": event_time,
    "direction": direction,
    "agreement": "consensus",
    "pairVote": 1 if direction == "long" else -1,
    "backgroundDirection": "none",
    "backgroundPairVote": 0,
    "backgroundAlignment": "neutral",
    "highestImpact": "high",
    "factorVotes": [],
    "events": [],
  }


def test_event_score_matches_existing_equal_surprise_momentum_formula() -> None:
  positive = score_event(calendar_event(1, 100, "EUR", "GDP q/q", "2.0", "1.5", "1.0"))
  conflict = score_event(calendar_event(2, 100, "EUR", "GDP q/q", "1.5", "1.0", "2.0"))
  unemployment = score_event(calendar_event(3, 100, "USD", "Unemployment Rate", "4.0", "4.2", "4.3"))

  assert positive and positive["score"] == 3
  assert conflict and conflict["score"] == 0
  assert unemployment and unemployment["score"] == 3


def test_release_packages_orient_eur_and_usd_and_retain_conflicted_majority() -> None:
  events = [
    calendar_event(1, 100, "EUR", "GDP q/q", "2.0", "1.5", "1.0"),
    calendar_event(2, 200, "USD", "GDP q/q", "2.0", "1.5", "1.0"),
    calendar_event(3, 300, "EUR", "GDP q/q", "2.0", "1.5", "1.0"),
    calendar_event(4, 300, "EUR", "Retail Sales m/m", "-1.0", "0.0", "0.0"),
    calendar_event(5, 300, "USD", "Consumer Confidence", "80", "90", "90"),
  ]

  packages = build_signal_candidates(events, now=400)

  assert [(row["eventTime"], row["direction"]) for row in packages[:2]] == [(100, "long"), (200, "short")]
  assert packages[2]["direction"] == "long"
  assert packages[2]["agreement"] == "conflicted_weak"


def test_background_alignment_is_measured_without_filtering_the_candidate() -> None:
  packages = build_signal_candidates([
    calendar_event(1, 100, "EUR", "GDP q/q", "2.0", "1.5", "1.0"),
    calendar_event(2, 200, "USD", "Retail Sales m/m", "2.0", "1.0", "1.0"),
  ], now=300)

  assert packages[1]["direction"] == "short"
  assert packages[1]["backgroundDirection"] == "long"
  assert packages[1]["backgroundAlignment"] == "conflicted"


def test_exact_vote_tie_is_retained_without_a_direction() -> None:
  package = build_signal_candidates([
    calendar_event(1, 100, "EUR", "GDP q/q", "2.0", "1.0", "1.0"),
    calendar_event(2, 100, "EUR", "Retail Sales m/m", "-1.0", "0.0", "0.0"),
  ], now=200)[0]

  assert package["direction"] == "none"
  assert package["agreement"] == "no_direction"
  assert package["pairVote"] == 0


def test_entry_is_strictly_after_release_and_uses_completed_atr() -> None:
  rows = candles()
  atr = calculate_atr_by_candle(rows)
  release_at_open = rows[20]["time"]
  result = evaluate_candidate(
    candidate(event_time=release_at_open),
    rows,
    [row["time"] for row in rows],
    atr,
    2.0,
  )

  assert result["entryTime"] == rows[21]["time"]
  assert result["atr"] == atr[20]


def test_live_paper_outcome_remains_pending_until_the_full_window_completes() -> None:
  rows = candles(count=30)
  atr = calculate_atr_by_candle(rows)
  result = evaluate_candidate(
    candidate(event_time=rows[20]["time"]),
    rows,
    [row["time"] for row in rows],
    atr,
    2.0,
    allow_pending=True,
    as_of=rows[-1]["time"] + 60,
  )

  assert result["status"] == "pending"
  assert result["entryTime"] == rows[21]["time"]
  assert aggregate_outcomes([result])["pendingCount"] == 1


def test_same_m1_bar_touch_is_ambiguous() -> None:
  rows = candles()
  atr = calculate_atr_by_candle(rows)
  entry_index = 21
  entry = rows[entry_index]["open"]
  risk = atr[entry_index - 1]
  assert risk is not None
  rows[entry_index] = {
    **rows[entry_index],
    "low": entry - risk - 0.0001,
    "high": entry + 2 * risk + 0.0001,
  }
  minute = [{
    "time": rows[entry_index]["time"],
    "open": entry,
    "high": entry + 2 * risk + 0.0001,
    "low": entry - risk - 0.0001,
    "close": entry,
    "volume": 1,
  }]

  result = evaluate_candidate(
    candidate(),
    rows,
    [row["time"] for row in rows],
    atr,
    2.0,
    lambda _from, _to: minute,
  )

  assert result["status"] == "ambiguous"
  assert result["reason"] == "Both touched — order unknown"


def test_expired_result_is_marked_to_market_and_included_in_expectancy() -> None:
  rows = candles()
  atr = calculate_atr_by_candle(rows)
  result = evaluate_candidate(
    candidate(), rows, [row["time"] for row in rows], atr, 2.0
  )
  metrics = aggregate_outcomes([result])

  assert result["status"] == "expired"
  assert result["resultR"] is not None
  assert metrics["expiredCount"] == 1
  assert metrics["averageR"] == result["resultR"]


def test_backtest_reports_split_cohorts_data_quality_and_plain_conclusion() -> None:
  rows = candles(count=100)
  events = [
    calendar_event(1, rows[20]["time"] + 1, "EUR", "GDP q/q", "2.0", "1.5", "1.0"),
    calendar_event(2, rows[50]["time"] + 1, "USD", "GDP q/q", "2.0", "1.5", "1.0"),
    calendar_event(3, rows[55]["time"] + 1, "USD", "GDP q/q", "", "1.5", "1.0"),
  ]
  result = build_backtest_result(
    events,
    rows,
    None,
    {"count": 3, "earliest": events[0]["time"], "latest": events[-1]["time"], "currencies": []},
    rows[-1]["time"] + 1,
  )

  activity = result["cohorts"]["factor"][0]
  assert result["resultSchemaVersion"] == 3
  assert activity["key"] == "activity"
  assert activity["development"] is not None
  assert activity["holdout"] is not None
  assert result["dataQuality"]["registeredEconomyRows"] == 3
  assert result["dataQuality"]["missingActualRows"] == 1
  assert result["conclusion"]["code"] == "no_validated_edge"
  assert "must not be placed on Charts" in result["conclusion"]["summary"]


def test_v2_is_labor_only_country_aware_and_scoped_to_eu_us_aggregates() -> None:
  definition = get_signal_definition(V2_VERSION_ID)
  assert definition is not None
  events = [
    {**calendar_event(1, 100, "EUR", "Unemployment Rate", "4.0", "4.2", "4.3"), "countryCode": "EU"},
    {**calendar_event(2, 100, "EUR", "Unemployment Rate", "6.0", "5.8", "5.7"), "countryCode": "DE"},
    {**calendar_event(3, 100, "EUR", "GDP q/q", "2.0", "1.5", "1.0"), "countryCode": "EU"},
    {**calendar_event(4, 200, "EUR", "Unemployment Rate", "3.9", "4.0", "4.0"), "countryCode": "EU"},
  ]

  packages = build_signal_candidates(events, now=300, definition=definition)

  assert [event["factor"] for event in packages[0]["events"]] == ["labor"]
  assert packages[0]["events"][0]["countryCode"] == "EU"
  assert all(event["title"] != "GDP q/q" for package in packages for event in package["events"])
  assert packages[1]["backgroundDirection"] == "long"

  result = build_backtest_result(
    events,
    candles(count=80),
    None,
    {"count": len(events), "earliest": 100, "latest": 200, "currencies": []},
    definition.created_at + 1,
    definition,
  )
  assert result["status"] == "exploratory_reused_history"
  assert result["eligibility"]["historicalEligibilityDisabled"] is True
  assert result["forwardPaper"]["metrics"]["candidateCount"] == 0
  assert result["conclusion"]["code"] == "forward_observation_required"
