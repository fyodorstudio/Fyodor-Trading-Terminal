# Release sequence “roof” proposal

Status: original research/design proposal, 7 October 2026. The first clickable
version is now implemented; see [implementation audit](Context-sequence-implementation-audit.md).
The proposal below is retained as research history. The implementation defaults
roof display On, exposes a separately labeled Weak fresh-news comparison, and
keeps USD relationship snapshots distinct from the optional EUR/USD relative
view. Automatic price/volatility evaluation remains deferred.

## What it means

A small bracket above existing event markers shows a developing numerical
sequence. It answers “which recent releases are connected in this interpretation?”
The bracket’s bias chip reuses the selected Raycaster context; it does not invent
a second combined score or claim that a rally is coming. A short description can
say **“Fresh labor/activity weakness; older inflation opposes.”**

The February–March case would therefore keep **EURUSD Short · Weak evidence**
through March 6 while exposing the developing opposing sequence. March 7 NFP
changes the existing combined chip to **EURUSD Long · Weak evidence**. The model’s
disagreement with earlier rising prices remains visible. This design does not
force an interpretation to agree with the observed candles.

## Proposed appearance

```text
       Release sequence · Developing evidence                    ⚙
       EURUSD Short · Weak evidence
       Fresh labor/activity weakness; older inflation opposes.
       ┌───────────────────────────────────────────┐
       │                │              │           │
    GDP + Claims       PCE         ISM Mfg      ISM Services
       Feb 27         Feb 28         Mar 3          Mar 5
```

This illustrates the completed historical sequence. At the February 27 cursor,
only that timestamp is known; PCE/ISM endpoints cannot appear yet. At March 3,
the bracket ends at Manufacturing. Services extends it on March 5. The bracket
can extend to later qualified publications such as Claims/NFP, within its declared
window. It is drawn in the event-marker lane, not anchored to a candle high or
resistance level.

- Use the existing directional chip colors. Label opposing inputs explicitly;
  do not color every endpoint as confirmation.
- GDP’s zero growth revision is gray **“No directional update”**, not a missing
  reading or extra Long vote. PCE is **“Small opposing vote”** in this case.
- Same-time GDP/Claims have one endpoint with two entries. Preserve their separate
  scorers but resolve their context effect atomically.
- ISM shares its existing monthly marker identity, with two publication-time
  endpoint ticks. Manufacturing and Services belong to one economic family and
  must not become two independent confirmations.
- Keep brackets compact; overlapping candidates share lanes or a count indicator.
  Zoomed-out clusters can collapse to one labeled span. Show full detail on hover
  or click, without altering price-chart hit testing or the drawing toolbar.

## Proposed candidate rule

Freeze the rule before looking at further price outcomes. A starting research rule:

1. Consider only enabled, observed numerical publications known at the selected
   historical time. Use a rolling seven broker-calendar-day window as a declared
   prototype, not a fitted optimum.
2. Require at least two different families representing two economic domains
   with fresh directional information. Claims plus ISM demand is a possible
   labor/activity sequence. Claims plus NFP alone is one labor domain; ISM
   Manufacturing plus Services alone is one surveyed-activity family.
3. Treat an unchanged GDP revision as a non-voting companion. Track opposing
   publications rather than deleting them to manufacture agreement. Derive
   “developing” versus “contested” from the available facts, while the combined
   bias/evidence continues to come from the existing engine.
4. Record standalone direction **and** the change in combined context when an
   old vote is replaced. A new Long report can be less USD-negative than the
   previous report and increase the net USD score. Those concepts are separate.
5. End or update the sequence when its window expires, its defining inputs are
   replaced, or new information removes the qualifying pattern. Do not extend
   it until the visually observed trend ends.

These conditions define a candidate presentation, not an implemented or validated
volatility detector. The final classification needs component/domain mapping so
overlapping labor, inflation and consumer-demand readings cannot masquerade as
independent confirmations. PCE income/spending companions are research candidates
only; they currently have no scorer vote.

## Details without extra work for the user

Clicking a roof opens a flat explanation:

| Publication | Standalone bias | Change in context | Role |
| --- | --- | --- | --- |
| GDP / Claims | No GDP update / Long | Less USD support | Companion / labor |
| PCE | Weak Short | Slightly more USD support | Opposing inflation |
| ISM Manufacturing | Weak Long | Less USD support | Activity; Services pending |
| ISM Services | Combined ISM Weak Long | Less USD support | Updates the same ISM family |

Below that, reuse the current contribution table and evidence limits. The price
audit is a separate optional section with fixed windows and explicit H1 precision;
its outcomes never feed the interpretation. One named direction remains available
where numerical direction exists; conflict is communicated through Weak evidence
and explanation, not a new Mixed label.

## Controls and chronology

- Add an independent **Show release sequences** display toggle, off initially,
  alongside Raycaster configuration. Reuse Raycaster’s input toggles and USD/relative
  mode instead of another scoring-filter system.
- Inspector filters continue to control marker visibility. Hidden sequence members
  are disclosed as “N inputs hidden by marker filters”; do not draw nonexistent
  symbols or silently remove their active context vote.
- Every sequence stores `knownAt`, actual publication clocks, endpoint IDs,
  component/domain roles and scorer/settings version. A historical cursor cannot
  read a later endpoint, final revision or subsequent Services publication.
- Calculate source membership in the existing background calculation path. Hover
  reads an indexed result. Pan/zoom only project endpoints to screen coordinates;
  neither operation reruns historical scorers.

## Folder and implementation plan

Extend existing boundaries rather than move chart ownership into scoring:

```text
usd-context/sequences/core/       domain roles, candidate rules, chronology/index
usd-context/sequences/runtime/    shared background calculation and settings key
price-chart/events/sequences/    bracket geometry, lanes, rendering/hit testing
raycaster/...                    display toggle and shared explanation view
tests/usd-context/...            future removal, atomic batches, overlap/expiry
tests/...                        marker-filter visibility and mounted integration
```

Exact chart/UI folder names should follow the current event-marker implementation
when this work is authorized. Keep the scoring library as the rule registry.
Scorer or settings changes invalidate cached candidate results. Use binary lookup
for historical selection and bounded viewport rendering; no all-history scan per
mouse movement. The user remains responsible for visual UI audits.

## Before calling it “historically high volatility”

That label needs evidence we do not yet have. A separate evaluation should:

- Replay all eligible past cases with frozen rules and release-time information,
  including contrary and low-volatility cases, not just hand-picked rallies.
- Count overlapping sequences as one episode; GDP/Claims at one clock are not
  two price observations. Preserve later conflicting updates.
- Measure direction and absolute movement separately over predeclared H1 windows.
  H1 cannot isolate the exact 20:30 release; use smaller bars for that claim if
  the existing broker dataset supplies them.
- Compare with ordinary/matched non-sequence windows and report sample counts,
  dispersion, misses, broker gaps and revision limitations. A declared minimum
  of 30 non-overlapping episodes per pattern is an initial coverage gate, not
  statistical proof of skill.
- Reserve a later chronological period for validation before refining thresholds.
  Keep all future price data in evaluation, never in candidate construction.

Until then, the accurate label is **Developing release sequence**, with the existing
context bias. A future fresh-news interpreter can be researched alongside memory
and promoted only after it adds repeatable explanatory value across unseen cases.
