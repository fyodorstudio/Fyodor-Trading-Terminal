import { describe, expect, it } from "vitest";
import {
  getEventReplayStatusLabel,
  sortEventTemplates,
} from "@/app/lib/eventReplayDisplay";
import type { EventTemplate } from "@/app/types";

function template(overrides: Partial<EventTemplate>): EventTemplate {
  return {
    key: overrides.key ?? `${overrides.currency ?? "USD"}|${overrides.title ?? "CPI y/y"}`,
    currency: overrides.currency ?? "USD",
    title: overrides.title ?? "CPI y/y",
    family: overrides.family ?? "inflation",
    familyLabel: overrides.familyLabel ?? "Inflation",
    sampleCount: overrides.sampleCount ?? 10,
    usableSampleCount: overrides.usableSampleCount ?? 8,
    quality: overrides.quality ?? "usable",
  };
}

describe("event replay display helpers", () => {
  it("renders concise feed status labels", () => {
    expect(getEventReplayStatusLabel("live")).toBe("Calendar live");
    expect(getEventReplayStatusLabel("stale")).toBe("Calendar stale");
    expect(getEventReplayStatusLabel("loading")).toBe("Loading events");
    expect(getEventReplayStatusLabel("no_data")).toBe("No calendar rows");
    expect(getEventReplayStatusLabel("error")).toBe("Bridge unavailable");
  });

  it("sorts event templates by quality before sample count", () => {
    const sorted = sortEventTemplates(
      [
        template({ title: "Weak", quality: "weak", sampleCount: 99 }),
        template({ title: "Limited", quality: "limited", sampleCount: 50 }),
        template({ title: "Usable Small", quality: "usable", sampleCount: 5 }),
        template({ title: "Usable Large", quality: "usable", sampleCount: 10 }),
      ],
      "quality",
    );

    expect(sorted.map((item) => item.title)).toEqual(["Usable Large", "Usable Small", "Limited", "Weak"]);
  });

  it("sorts event templates by sample count with quality as tie-breaker", () => {
    const sorted = sortEventTemplates(
      [
        template({ title: "Limited Same Count", quality: "limited", sampleCount: 10 }),
        template({ title: "Usable Same Count", quality: "usable", sampleCount: 10 }),
        template({ title: "Largest", quality: "weak", sampleCount: 20 }),
      ],
      "sample_count",
    );

    expect(sorted.map((item) => item.title)).toEqual(["Largest", "Usable Same Count", "Limited Same Count"]);
  });

  it("sorts event templates by currency then title", () => {
    const sorted = sortEventTemplates(
      [
        template({ currency: "USD", title: "Retail Sales" }),
        template({ currency: "EUR", title: "GDP q/q" }),
        template({ currency: "USD", title: "CPI y/y" }),
      ],
      "currency",
    );

    expect(sorted.map((item) => `${item.currency}|${item.title}`)).toEqual([
      "EUR|GDP q/q",
      "USD|CPI y/y",
      "USD|Retail Sales",
    ]);
  });
});
