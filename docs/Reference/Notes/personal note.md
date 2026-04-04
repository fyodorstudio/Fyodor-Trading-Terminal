Perfect — that pasted context helps, and yes, I’ll treat it as an added constraint set.

Big takeaway: your docs overhaul prompt should now do **2 jobs at once**:

1. **clarify the product identity and workflow**
2. **tighten the “what to do next” track/tickbox roadmap much harder**

So the prompt I gave before should be strengthened to make Codex:

* preserve your current product truth
* absorb the new clarified workflow from this convo
* **rebuild the checklist hierarchy more aggressively**
* make the exhaustive file much more useful as a next-action control doc

Here’s the **improved version** you should paste to Codex instead of the previous one:

---

You are updating the product documentation for my trading app.

Your job is to **overhaul, tighten, and clarify** these two markdown files so they become much more useful as:

* a **clear product authority**
* a **clear implementation direction document**
* a **clear next-action checklist with track-based priorities**

You must update these docs consistently:

* `PRODUCT_BRIEF.md`
* `PRODUCT_EXHAUSTIVE.md`

Use the current docs as the baseline truth for what already exists, but refine them based on the clarified product direction below.
The brief remains the short product authority.
The exhaustive file remains the detailed implementation inventory and active roadmap / checklist.  

---

# 1. Core product truth to preserve and sharpen

Fyodor Trading Terminal is a **pre-trade briefing and macro triage tool**.

It is **not** a trade prediction engine. 

Its purpose is to help answer quickly and honestly:

1. Is this market worth attention right now?
2. Is the macro backdrop supportive, hostile, or unclear?
3. Is event risk close enough to invalidate or distort the setup?
4. Is the data live, stale, degraded, or unavailable?
5. Is this a market to study now, monitor later, or ignore for the moment? 

Preserve and strengthen these existing rules:

* connection-first trust matters most
* missing values are better than guessed values
* transparent logic is better than black-box output
* Overview is for orientation, specialist tabs are for deep detail
* one module alone must not decide whether a pair is worth attention
* if trust weakens, the change is wrong 

---

# 2. Clarified workflow truth to add explicitly

The docs must now make this workflow explicit:

I trade **discretionary TA manually in TradingView**.

That means:

* I inspect charts first
* I manually mark support/resistance and supply/demand
* I manually decide entries
* I manually decide SL, TP1, TP2, RR, and final execution
* I use a top-down chart read such as `D1 -> H4 -> H1`

This app exists to sit **beside TradingView**, not replace it.

TradingView is for:

* TA
* structure read
* entry planning
* execution

This app is for:

* market context
* macro pressure
* event risk
* trust / data state
* behind-the-scenes drivers
* identifying whether a pair or asset deserves more attention
* helping identify which pair or asset is the cleaner expression of an active theme

The app should reduce the painful manual research of:

* what is moving price
* which side is winning
* why that side is winning
* whether the move is trustworthy enough to respect
* whether event conditions support, distort, or threaten the setup
* whether another pair/asset expresses the same theme better

The app should **not** try to replace my chart reading.

---

# 3. The app must not drift into these identities

Make this explicit in the docs:

The app must not become:

* a signal bot
* an auto-TA engine
* a fake-certainty layer
* a black-box score machine
* a replacement for trader discretion

It should help me think faster, not pretend to think for me.

---

# 4. Questions the app should help answer fast

Center the brief and roadmap more clearly around these questions:

1. **Which side is winning?**
2. **Why are they winning?**
3. **Can I trust this move?**
4. **What event risk matters right now?**
5. **Is there a better pair or asset to express this active theme?**

These questions should influence both:

* how the brief defines the product
* how the exhaustive roadmap prioritizes future work

---

# 5. Important clarified concept: theme expression / cleaner vehicle

The docs should explicitly capture this idea:

When a currency or macro theme is active, the app should eventually help identify **which pair or asset is expressing that theme most cleanly**.

Example:

* if USD is the active theme, EURUSD, GBPUSD, USDJPY, gold, and other related markets may not behave equally
* some lag
* some overreact
* some are cleaner
* some are noisy

This should be captured as a practical product concept, even if terminology is not fully frozen yet.

Do not overcomplicate naming.
Make the idea clear in plain language.

---

# 6. Current app reality that should still be respected

Preserve the fact that these already exist at a high level:

* Overview Mission Control is the main active surface
* Overview already includes trust-state, pair-attention, macro backdrop verdict, Overview Confidence, searchable pair selector, event radar, macro story, strength summary, and action shortcuts
* Charts, Economic Calendar, Central Banks Data, Differential Calculator, Strength Meter, Event Quality, and Event Reaction Engine already exist
* MT5 bridge and EA pipeline already exist and should be preserved  

Do not rewrite the product as if these modules do not exist.
This is a refinement of the same product, not a reset.

---

# 7. Current known product gaps and externally supplied truth to incorporate

Treat the following as valid product direction that should influence the roadmap:

Known gaps:

* cross-asset alignment map does not exist yet
* watchlist-priority workflow does not exist yet
* Strength Meter methodology is still not final
* some central-bank `N/A` cases still need refinement
* final answer on single-pair vs broader multi-pair Overview is not locked

External recommendation truth to incorporate into roadmap thinking:

* the highest-value next direction is not cosmetic polish or more indicators
* the best edge/profit features are those that improve:

  * market selection
  * timing exclusion
  * transparency
  * event preparation
  * workflow speed

Top recommended feature priorities to reflect in the exhaustive roadmap:

1. **Watchlist Priority Engine**
2. **Cross-Asset Alignment Map**
3. **Tradeability Window Layer**
4. **Event Reaction Engine -> Execution Prep upgrade**
5. **Strength Meter v2**
6. **Multi-pair Overview panel**

Most important recommendation:

* **Watchlist Priority Engine** should be treated as the strongest next feature direction

Why:

* it fills one of the clearest missing gaps
* it moves the app from “analyze the pair I picked” toward “show me what deserves attention first”
* it is closer to real trader edge and real workflow value

---

# 8. Current data reality for cross-market context

The current MT5/broker symbol universe already supports a useful first cross-market layer.
Confirmed accessible symbols include:

* `XAUUSD`
* `XTIUSD`
* `XBRUSD`
* `SPX500`
* `NAS100`
* `US30`
* optional regional indices like `GER40`, `UK100`, `JPN225`   

The docs and roadmap should reflect that:

* a first cross-market context / alignment feature can be built now from currently accessible symbols
* DXY and bond yields should **not** be assumed as current dependencies, because they are not shown in the current symbol list 
* DXY / yields may be mentioned only as optional future enhancements, not current required inputs

---

# 9. What to do in `PRODUCT_BRIEF.md`

Overhaul the brief so it becomes a much sharper and more explicit short authority.

## The brief should:

* keep its compactness
* preserve the current product truth
* add the clarified “manual TA in TradingView, app for context” workflow
* become clearer about what the app is and is not
* reflect the updated practical questions the app exists to answer

## Add or strengthen sections like:

* **What The Product Is**
* **How It Is Used**
* **What It Must Not Become**
* optional short **Who It Is For** section if it helps clarity

## Explicitly state:

* I inspect the chart first
* I use the app beside TradingView
* the app explains the behind-the-scenes pressure
* the app helps decide whether the setup deserves more attention
* the app does not replace discretionary execution

Do not bloat the brief.

---

# 10. What to do in `PRODUCT_EXHAUSTIVE.md`

This is the most important part.

The exhaustive file must become **much more useful as an active checklist / next-step control document**.

Do not just preserve the old checklist structure mechanically.
Tighten it, reorganize it where needed, and make the roadmap more deliberate.

## Strong requirement:

Emphasize and improve:

* **tracks**
* **priorities**
* **what to do next**
* **decision gates**
* **implementation sequencing**
* **manual audit checkpoints**

The exhaustive file should feel like a practical build control sheet, not just a long inventory dump.

## Update the roadmap/checklist so it reflects this hierarchy better

### Highest-priority checklist direction

1. **Lock the product stance in docs**

   * manual TA outside the app
   * app beside TradingView
   * no drift into signal-bot or fake-certainty product identity
   * future work should stay inside this boundary

2. **Finish Track 1: Overview Completion under the clarified product role**

   * Overview should help answer:

     * which side is winning
     * why
     * can I trust it
     * what event risk matters
   * keep Overview pair-first for now unless explicitly decided otherwise
   * keep Overview operationally honest
   * verify that wording does not overstate certainty

3. **Add a new high-priority track for Watchlist Priority Engine**

   * this should be elevated clearly in the checklist
   * it should not be a vague future idea
   * it should have explicit decision items and implementation steps
   * it should use existing signals first:

     * trust state
     * macro backdrop
     * event sensitivity / event quality
     * strength differential
     * ATR / volatility context
   * it should support:

     * Study now
     * Monitor
     * Ignore for now
   * it should include:

     * transparent reason tags
     * degraded / no-data handling
     * breakdown / inspector
     * wording audit for false certainty

4. **Add a high-priority track for Cross-Asset Alignment / Cross-Market Context**

   * make it explicit that v1 should use current available symbols only
   * keep it transparent and descriptive
   * capture the idea of aligned / mixed / diverging context
   * connect it to pair selection and trust, not prediction

5. **Add a high-priority track for Tradeability Window Layer**

   * frame it as answering whether the market is actually tradeable right now
   * likely ingredients:

     * session context
     * volatility
     * event timing
     * trust state
   * example labels may remain provisional, but the concept should be explicit

6. **Keep Macro / Data Quality Refinement strong**

   * reducing unresolved central-bank `N/A` and preserving honest derivations still matter
   * this should remain above aesthetic improvements

7. **Promote Event Reaction Engine usefulness**

   * shift it toward execution prep usefulness, not just historical research richness
   * capture ideas like:

     * reaction reliability
     * typical initial move range
     * fade vs continuation tendency
     * best historical pairs for event family
     * weak-sample warnings

8. **Strength Meter v2**

   * keep it explainable
   * improve beyond 60/40
   * do not let it become black-box output

9. **Multi-pair Overview panel**

   * keep as valid direction
   * likely below watchlist and cross-market context unless the checklist logic suggests otherwise

10. **Visual polish remains below logic, trust, and workflow**

* do not remove it
* just keep it in the right priority tier

---

# 11. Add better track / checklist structure

I want the exhaustive file to feel more actionable.

So improve the structure with things like:

* clear track names
* “Critical / Important / Nice To Have” that are actually meaningful
* explicit “Decision To Lock” items
* explicit “Implementation Focus” items
* explicit “Manual Audit” items
* explicit “Research / Open Questions” items

For example, for Watchlist Priority Engine, I want checklist items like:

* confirm it as next core build
* decide whether it lives inside Overview first
* decide minimum ranking inputs
* decide final action labels
* decide how unresolved data affects ranking
* decide whether cross-asset alignment is v1 or later
* decide whether Tradeability Window is part of pair-attention or separate
* freeze relevant terminology for this pass

And implementation-focus items like:

* create `pairPriorityScore`
* add ranked watchlist panel in Overview
* add reason tags per pair
* add click-to-focus behavior
* add degraded/no-data handling
* add transparent breakdown inspector
* do wording audit to avoid false certainty
* checkpoint before and after major changes

Use those ideas, but integrate them properly into the existing document rather than awkwardly pasting them in.

---

# 12. Add stronger manual audit prompts

The exhaustive file should explicitly include practical audit items such as:

* verify whether the app answers “which side is winning and why?” fast enough
* verify whether event warnings are useful in practice and not decorative
* verify whether watchlist ranking genuinely improves attention allocation
* verify whether cross-market context helps pair selection or only adds noise
* verify whether the app helps identify a cleaner pair/asset expression of a theme
* verify that no verdict sounds more certain than the evidence deserves
* verify that Overview still feels simple under tired real trading-day use

---

# 13. Tone and style requirements

* keep the docs clear, human, and practical
* avoid bloated SaaS jargon
* avoid turning the docs into giant essays
* avoid pretending everything is already solved
* keep the tone close to a real discretionary trading workflow
* preserve the compact terminal-like product feel
* preserve honesty and operational clarity

---

# 14. Output requirements

When you finish:

1. update both markdown files directly
2. keep useful existing structure where possible
3. tighten vague wording
4. improve the roadmap / track / tickbox usefulness substantially
5. do not invent unnecessary technical details
6. do not remove important existing truths
7. keep the brief compact and authoritative
8. make the exhaustive file much stronger as a “what to do next” control sheet

Then show me:

1. a concise summary of what changed in `PRODUCT_BRIEF.md`
2. a concise summary of what changed in `PRODUCT_EXHAUSTIVE.md`
3. the full updated markdown for both files
4. any old wording that conflicted with the clarified direction
5. any terminology decisions that should stay intentionally unlocked for now

Do the work thoroughly, but keep the output disciplined and readable.

---

This revised version is better because it tells Codex much more clearly that the exhaustive file is not just “a detailed doc,” but a **real prioritized build checklist**.

When you want, I can also make you a **second Codex prompt just for the checklist architecture itself** — meaning one that only focuses on making the tracks/tickboxes brutally good 📋
