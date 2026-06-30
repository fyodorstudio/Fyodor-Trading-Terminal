import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ANALYSIS_TAB_ORDER, TAB_ORDER } from "@/app/config/navigation";
import { PrototypingTab } from "@/app/tabs/secondary/PrototypingTab";

describe("navigation truth", () => {
  it("promotes active Specialist Tools children before the garbage drawer", () => {
    expect(ANALYSIS_TAB_ORDER).toEqual([
      { id: "dashboard", label: "DIFFERENTIAL CALCULATOR", groupLabel: "Active Tool" },
      { id: "event-tools", label: "EVENT REPLAY", groupLabel: "Active Experiment" },
      { id: "prototyping", label: "PROTOTYPING", groupLabel: "Garbage / Ignore" },
    ]);
    expect(ANALYSIS_TAB_ORDER).not.toContainEqual({ id: "terminal-questions", label: "SIX QUESTIONS DRAFT" });
    expect(ANALYSIS_TAB_ORDER).not.toContainEqual({ id: "work-in-progress", label: "WIP MAP ARCHIVE" });

    const specialist = TAB_ORDER.find((tab) => tab.id === "dashboard");
    expect(specialist?.children).toContainEqual({ id: "dashboard", label: "DIFFERENTIAL CALCULATOR", groupLabel: "Active Tool" });
    expect(specialist?.children).toContainEqual({ id: "event-tools", label: "EVENT REPLAY", groupLabel: "Active Experiment" });
    expect(specialist?.children).toContainEqual({ id: "prototyping", label: "PROTOTYPING", groupLabel: "Garbage / Ignore" });
  });

  it("moves old planning drafts into the garbage drawer", () => {
    const html = renderToStaticMarkup(<PrototypingTab onNavigate={() => {}} />);

    expect(html).toContain("Garbage Drawer");
    expect(html).toContain("Ignore");
    expect(html).toContain("Six Questions Draft");
    expect(html).toContain("WIP Map Archive");
    expect(html).toContain("Strength Meter");
    expect(html).toContain("Deprecated Overview");
    expect(html).not.toContain("Differential Calculator");
    expect(html).not.toContain("Legacy Overview");
    expect(html).not.toContain("Event replay, reaction studies, and calendar prep tools.");
    expect(html).not.toContain(">Event Tools<");
  });

});
