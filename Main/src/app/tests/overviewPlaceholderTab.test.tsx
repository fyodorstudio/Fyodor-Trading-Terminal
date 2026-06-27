import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OverviewPlaceholderTab } from "@/app/tabs/primary/OverviewPlaceholderTab";

describe("OverviewPlaceholderTab", () => {
  it("points legacy overview routing at Prototyping instead of the archived WIP map", () => {
    const html = renderToStaticMarkup(<OverviewPlaceholderTab />);

    expect(html).toContain("Specialist Tools, then Prototyping, then Deprecated Overview");
    expect(html).not.toContain("WORK IN PROGRESS");
  });
});
