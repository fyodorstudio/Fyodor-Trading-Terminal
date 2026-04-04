import { classifyEventQualityFamily } from "@/app/lib/eventQuality";
import type { CalendarEvent, CalendarEventExplainer, EventQualityFamily } from "@/app/types";

const FAMILY_EXPLAINERS: Record<EventQualityFamily, Omit<CalendarEventExplainer, "family" | "familyLabel"> & { familyLabel: string }> = {
  policy: {
    familyLabel: "Policy / Rates",
    whatItIs: "This event updates the market on central-bank policy or interest-rate direction.",
    whyTradersCare: "Rate decisions and policy guidance can quickly change expectations for currency strength, rate differentials, and risk appetite.",
    mayAffect: ["The event currency and its major FX pairs", "Rate-sensitive markets", "Gold and broad risk sentiment when the central bank is globally important"],
    priceCaveats: [
      "The reaction depends on both the actual decision and the tone of the guidance.",
      "If the market already expected the outcome, price can fade quickly instead of extending.",
    ],
    educationalSummary: "Policy events matter because currencies often reprice when traders rethink the path of future rates, liquidity, and central-bank credibility.",
    strongerOutcome: "A more hawkish outcome or tone can support the currency if it implies tighter policy or higher rates than expected.",
    weakerOutcome: "A more dovish outcome or softer tone can weaken the currency if it implies easier policy or lower rates than expected.",
    contextNote: "Policy events are especially powerful when markets are unsure about the next decision or when guidance meaningfully shifts the expected rate path.",
  },
  inflation: {
    familyLabel: "Inflation",
    whatItIs: "This event measures changes in consumer prices or inflation pressure.",
    whyTradersCare: "Inflation shapes how much pressure a central bank may feel to tighten, pause, or ease policy.",
    mayAffect: ["The event currency and its major FX pairs", "Rate expectations", "Gold and yields when the release changes central-bank expectations"],
    priceCaveats: [
      "A hot or soft print does not move price equally in every cycle.",
      "Inflation matters less when traders are focused on growth stress, policy communication, or positioning instead.",
    ],
    educationalSummary: "Inflation releases matter because they change how traders think about future policy, real yields, and whether current rates are restrictive enough.",
    strongerOutcome: "Higher-than-expected inflation can support the currency if traders think it raises the odds of tighter policy or fewer cuts.",
    weakerOutcome: "Lower-than-expected inflation can weaken the currency if traders think it reduces policy-tightening pressure or opens the door to easing.",
    contextNote: "The same inflation surprise can matter very differently depending on whether the central bank is already worried about inflation or already focused on growth weakness.",
  },
  labor: {
    familyLabel: "Labor",
    whatItIs: "This event measures employment conditions, hiring momentum, unemployment, or wage pressure.",
    whyTradersCare: "Labor data helps traders judge economic resilience, consumer strength, and whether wage pressure may spill into inflation.",
    mayAffect: ["The event currency and its major FX pairs", "Short-term rate expectations", "Broad risk mood when the labor market is seen as a growth anchor"],
    priceCaveats: [
      "Headlines can mislead if wages, participation, or revisions point the other way.",
      "Labor events can create fast first moves that are later rebalanced once the details are digested.",
    ],
    educationalSummary: "Labor data matters because jobs and wages influence growth, inflation pressure, and how confidently a central bank can stay tight or pivot.",
    strongerOutcome: "Stronger hiring or wages can support the currency if traders read it as economic strength or inflation persistence.",
    weakerOutcome: "Weaker employment data can hurt the currency if traders read it as growth deterioration or a reason for looser policy later.",
    contextNote: "Labor data becomes especially important when the market is debating recession risk, wage inflation, or whether the economy is finally slowing.",
  },
  gdp: {
    familyLabel: "GDP",
    whatItIs: "This event measures the economy’s broad growth rate over the reported period.",
    whyTradersCare: "GDP helps traders judge whether the economy is accelerating, slowing, or diverging from other major economies.",
    mayAffect: ["The event currency and its major FX pairs", "Growth-sensitive assets", "Broader sentiment if the economy is systemically important"],
    priceCaveats: [
      "GDP is important, but it is often less explosive than policy or inflation events because it can lag current conditions.",
      "Revisions, composition, and what markets already expected all matter.",
    ],
    educationalSummary: "GDP matters because currencies often strengthen when traders believe an economy is outperforming peers or can handle tighter policy.",
    strongerOutcome: "A stronger-than-expected GDP print can support the currency if it reinforces a growth advantage or reduces easing expectations.",
    weakerOutcome: "A weaker-than-expected GDP print can weaken the currency if it raises slowdown concerns or increases easing expectations.",
    contextNote: "GDP usually matters more when markets are questioning whether a country is slipping into slowdown or outperforming peers in a visible way.",
  },
  activity: {
    familyLabel: "PMI / ISM / Activity",
    whatItIs: "This event tracks business activity, new orders, sentiment, or consumer spending momentum.",
    whyTradersCare: "Activity data gives traders a faster pulse on growth conditions than slower-moving macro releases.",
    mayAffect: ["The event currency and its major FX pairs", "Equity index sentiment", "Commodities or cyclical assets when growth implications are strong"],
    priceCaveats: [
      "These releases can matter a lot when they are one of the first signs of a turn, but less when the macro story is already well known.",
      "Subcomponents such as prices, employment, or new orders can matter more than the headline.",
    ],
    educationalSummary: "Activity indicators matter because they can shift growth expectations earlier than slower official reports, especially around turning points.",
    strongerOutcome: "A stronger activity reading can support the currency if it implies healthier growth or better business momentum.",
    weakerOutcome: "A weaker activity reading can weigh on the currency if it suggests growth is cooling or demand is deteriorating.",
    contextNote: "Activity data is most useful when the market is searching for early signs that the economy is improving, stalling, or breaking trend.",
  },
  trade_confidence: {
    familyLabel: "Trade / Confidence",
    whatItIs: "This event tracks trade balance, external demand, or confidence-related measures tied to growth expectations.",
    whyTradersCare: "These releases can shape growth expectations and show whether demand, sentiment, or external balance is improving or worsening.",
    mayAffect: ["The event currency and its major FX pairs", "Growth-sensitive sectors or regional risk sentiment", "Theme validation for broader macro positioning"],
    priceCaveats: [
      "These events usually matter less than policy, inflation, or labor unless they strongly reinforce a developing macro theme.",
      "The market may ignore them when larger scheduled releases are nearby.",
    ],
    educationalSummary: "Trade and confidence releases matter most when they help confirm whether demand, competitiveness, or sentiment is improving or rolling over.",
    strongerOutcome: "A stronger result can support the currency if it improves the growth or external-balance picture.",
    weakerOutcome: "A weaker result can pressure the currency if it adds to concerns about demand, competitiveness, or sentiment.",
    contextNote: "These events often work best as context-builders rather than standalone market movers unless the surprise is unusually large.",
  },
};

const GENERIC_EXPLAINER: CalendarEventExplainer = {
  family: "generic",
  familyLabel: "General Macro Event",
  whatItIs: "This event updates the market on an economic or policy-related data point.",
  whyTradersCare: "Traders care because new macro information can change expectations for growth, inflation, policy, and relative currency strength.",
  mayAffect: ["The event currency and its major FX pairs", "Theme-related assets if the release changes the broader macro picture"],
  priceCaveats: [
    "Not every release moves price meaningfully, especially if the result was already expected.",
    "The surrounding macro theme often matters more than the event in isolation.",
  ],
  educationalSummary: "Macro events matter when they change the market’s expectations, not just because they appear on the calendar.",
  strongerOutcome: "A stronger-than-expected result can support the currency if traders see it as growth-positive or policy-supportive.",
  weakerOutcome: "A weaker-than-expected result can hurt the currency if traders see it as growth-negative or policy-softening.",
  contextNote: "Always compare the event to the existing macro story, nearby larger releases, and how much of the outcome the market already priced in.",
};

export function getCalendarEventExplainer(event: CalendarEvent): CalendarEventExplainer {
  const family = classifyEventQualityFamily(event.title);
  if (!family) {
    return GENERIC_EXPLAINER;
  }

  return {
    family: family.family,
    familyLabel: family.label,
    ...FAMILY_EXPLAINERS[family.family],
  };
}
