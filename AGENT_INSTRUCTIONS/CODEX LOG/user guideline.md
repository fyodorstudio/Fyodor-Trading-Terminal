# Trading Terminal User Guideline

## Purpose

This guide explains, in plain language, what the next macro features are meant to do and how a beginner should use them.

This app is not meant to tell you:
- exactly when to buy
- exactly when to sell
- that a trade is guaranteed to work

This app is meant to help you:
- focus on better markets
- avoid bad timing
- understand whether macro is helping or fighting your trade idea
- reduce noise before you even look at the chart deeply

Think of it as a **pre-trade briefing tool**, not a prediction machine.

---

## How To Use The App Overall

A simple beginner flow should look like this:

1. Open a market you are interested in, for example `EURUSD`.
2. Check whether macro conditions are supportive or hostile.
3. Check whether an important event is close enough to invalidate the setup.
4. Check whether the market is worth your attention right now.
5. Only then move to chart execution and trade planning.

The goal is not to overanalyze everything.

The goal is to answer:
- Is this market worth my attention?
- Is there a macro reason to be careful?
- Is an important event about to create noise or danger?

---

## Current Core Tabs

### Overview

This tab is planned to become the main summary page.

In the future, it should help the user answer:
- What is the macro backdrop for this pair?
- Is the rate gap supportive or not?
- Is inflation diverging or converging?
- Is there event risk soon?

This tab should eventually be the fastest place to understand whether a market deserves attention.

### Central Banks Data

This tab shows the latest MT5-fed policy rate and inflation data for the major central banks.

What it is useful for:
- understanding the current rate backdrop
- checking whether inflation is high or low relative to another currency
- seeing upcoming scheduled central-bank or inflation events if MT5 exposes them

Important:
- this tab is based on MT5 calendar data
- if MT5 does not expose a future event, the app should say so honestly
- the app should prefer missing values over fake values

### Charts

This tab is for live and historical price action.

What it is useful for:
- checking structure
- checking recent candles
- monitoring live market movement
- connecting macro context to actual price behavior

Charts answer: "What is price doing?"

### Economic Calendar

This tab shows MT5-fed economic events.

What it is useful for:
- seeing what happened today
- seeing what is coming this week
- checking actual, forecast, and previous values
- checking event timing before entering a trade

Calendar answers: "What event risk is around this market?"

---

## Future Features And How A Beginner Would Use Them

## 1. Policy Differential v0

### What it means

This feature compares the central-bank backdrop of one currency against another.

Example:
- `EURUSD`
- compare `ECB` vs `Federal Reserve`

### What it would show

- current policy-rate differential
- inflation differential
- whether the rate gap is widening, narrowing, or stable
- how the gap changed over the last 3 months
- how the gap changed over the last 12 months

### What problem it solves

It helps answer:
- Is one currency still supported by higher rates?
- Is that support getting stronger or weaker?
- Is the macro backdrop changing?

### How a beginner should use it

Before taking a trade idea, ask:
- Is the market fighting the rate backdrop?
- Is the rate backdrop neutral?
- Is the backdrop changing fast enough that I should be careful?

Example:
- If USD still has the stronger rate backdrop, then buying `EURUSD` may need more caution.
- If the gap is narrowing, then the old macro headwind may be weakening.

### What result to expect

This should not say:
- buy now
- sell now

It should say something more realistic like:
- `USD rate advantage still exists`
- `Rate gap has narrowed over 3 months`
- `Macro headwind is weakening`

---

## 2. Event Density / Event Quality Filter

### What it means

This feature checks whether the next 24 to 72 hours are clean or messy for a selected market.

### What it would show

- relevant upcoming events for the selected asset
- a timing label:
  - `Clean`
  - `Mixed`
  - `Dirty`

### What problem it solves

Sometimes the trade idea is fine, but timing is bad.

Example:
- CPI today
- central-bank event tomorrow
- labor data a few hours later

That kind of environment can make a setup unreliable even if the chart looks good.

### How a beginner should use it

Use this as a trade filter.

Ask:
- Is this a stable environment?
- Are there too many important events close together?
- Is this setup likely to get invalidated soon?

### What result to expect

Instead of reading a long calendar manually, the app should give a simple decision-quality summary like:
- `Clean environment`
- `Mixed event risk`
- `Dirty event environment`

This does not predict direction.

It helps avoid bad timing.

---

## 3. Event Reaction Engine

### What it means

This feature studies how markets historically reacted after specific economic events.

### What it would show

For an event like `US CPI`, the app could show:
- whether the result beat or missed forecast
- how big the surprise was
- how a market moved after the release:
  - 15 minutes
  - 1 hour
  - 4 hours
  - 1 day
- average move
- median move
- variability
- sample size

### What problem it solves

Not every important-looking event actually moves every market cleanly.

This feature helps answer:
- Should I trade this event at all?
- Which asset reacts best to this release?
- Is the reaction historically consistent or noisy?

### How a beginner should use it

Before a big event, use this feature to understand whether the event has historically mattered for your chosen market.

Example:
- if `US CPI` usually creates strong, consistent `EURUSD` moves, that is useful
- if the historical reaction is messy and inconsistent, that is also useful

### What result to expect

The result should look like:
- `Large upside CPI surprises often strengthen USD in the first hour`
- `Weak sample, use caution`
- `Historically noisy event for this asset`

This should help with market selection and timing, not prediction certainty.

---

## 4. Cross-Asset Alignment Map

### What it means

This feature checks whether the broader market is agreeing or disagreeing with your trade idea.

### What it could compare

A small anchor set, for example:
- DXY proxy
- US 2Y yield
- US 10Y yield
- Gold
- Oil
- One equity index

### What problem it solves

Sometimes the chart looks good, but broader macro markets are sending the opposite message.

### How a beginner should use it

Use this as a reality check.

Ask:
- Is the broader market supporting my idea?
- Are important related markets contradicting my idea?

### What result to expect

Something simple like:
- `Alignment supportive`
- `Mixed alignment`
- `Contradictory cross-asset signals`

This should help reduce blind trades that ignore the broader macro tape.

---

## 5. Market Selection / Watchlist Priority Engine

### What it means

This feature helps reduce overload by sorting markets into a few simple buckets.

### What it would use

It would eventually combine signals from:
- Policy Differential
- Event Density
- Event Reaction Engine
- Cross-Asset Alignment

### What problem it solves

Too many traders waste energy watching too many markets.

This feature should help narrow focus.

### How a beginner should use it

Use it as a focus tool, not a signal generator.

Expected buckets:
- `High Focus`
- `Monitor`
- `Ignore`

### What result to expect

Instead of asking "What can I trade today?", the user gets help answering:
- "Which few markets deserve my attention today?"

---

## What The User Should Not Expect

These future features should not become:
- a magic buy/sell machine
- a giant dashboard full of numbers
- a fake 0-100 macro score
- an AI storyteller that sounds smart but hides weak logic

This app should stay:
- transparent
- practical
- honest about uncertainty

---

## Beginner Mindset

If you are new, use the future features in this order:

1. Check whether the market is worth attention.
2. Check whether macro is supportive or hostile.
3. Check whether upcoming events make timing dangerous.
4. Then check the chart.

Do not try to force every feature into every trade.

The app should help you trade fewer, cleaner setups.

---

## Plain-Language Summary

If these future features are built well, the app should help a beginner answer:

- Which market is worth my attention?
- Is macro helping this idea?
- Is an event about to ruin the setup?
- Should I slow down, avoid, or pay closer attention?

That is the real purpose of the app.
