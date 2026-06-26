import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkInProgressTab } from "@/app/tabs/WorkInProgressTab";

describe("WorkInProgressTab", () => {
  it("renders the hero and the two data tables", () => {
    const html = renderToStaticMarkup(<WorkInProgressTab />);

    expect(html).toContain("WORK IN PROGRESS");
    expect(html).toContain("Archived Planning Map");
    expect(html).toContain("Historical capability notes");
    expect(html).toContain("Possible With Current Data");
    expect(html).toContain("Currency strength from candles");
    expect(html).toContain("Current hard limit");
    expect(html).toContain("What Extra Data Unlocks The Next Level");
    expect(html).toContain("Fed funds, SOFR, and other short-rate futures");
    expect(html).toContain("Event reaction replay");
    expect(html).not.toContain("Target Workflow");
    expect(html).not.toContain("Open Prototype Panel");
  });
});
