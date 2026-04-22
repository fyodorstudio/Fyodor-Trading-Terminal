import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkInProgressTab } from "@/app/tabs/WorkInProgressTab";

describe("WorkInProgressTab", () => {
  it("renders the hero, target workflow, and the two data tables", () => {
    const html = renderToStaticMarkup(
      <WorkInProgressTab
        onOpenWatchlistTab={() => {}}
        onOpenPrototypeTab={() => {}}
        onOpenLegacyOverviewTab={() => {}}
        onOpenDashboardTab={() => {}}
        onOpenStrengthMeterTab={() => {}}
        onOpenEventToolsTab={() => {}}
      />,
    );

    expect(html).toContain("WORK IN PROGRESS");
    expect(html).toContain("Target Workflow");
    expect(html).toContain("Possible With Current Data");
    expect(html).toContain("Current hard limit");
    expect(html).toContain("What Extra Data Unlocks The Next Level");
    expect(html).toContain("Fed funds, SOFR, and other short-rate futures");
    expect(html).toContain("Open Prototype Panel");
  });
});
