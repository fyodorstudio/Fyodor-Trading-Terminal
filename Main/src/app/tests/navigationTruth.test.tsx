import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ANALYSIS_TAB_ORDER, TAB_ORDER } from "@/app/config/navigation";
import { PrototypingTab } from "@/app/tabs/secondary/PrototypingTab";

describe("navigation truth", () => {
  it("keeps Charts as the sole primary route while classifying retained and garbage workspaces", () => {
    expect(ANALYSIS_TAB_ORDER).toEqual([
      { id: "macro-signal-lab", label: "FMS EXPERIMENT WORKBENCH", groupLabel: "Retained Research Workspace" },
      { id: "dashboard", label: "DIFFERENTIAL CALCULATOR", groupLabel: "Retained Experiment / Hidden" },
      { id: "event-tools", label: "EVENT REPLAY", groupLabel: "Garbage / Ignore" },
      { id: "macro-drivers", label: "MACRO DRIVERS", groupLabel: "Garbage / Ignore" },
      { id: "prototyping", label: "PROTOTYPING", groupLabel: "Garbage / Ignore" },
    ]);
    expect(ANALYSIS_TAB_ORDER).not.toContainEqual({ id: "terminal-questions", label: "SIX QUESTIONS DRAFT" });
    expect(ANALYSIS_TAB_ORDER).not.toContainEqual({ id: "work-in-progress", label: "WIP MAP ARCHIVE" });

    expect(TAB_ORDER).toEqual([{ id: "charts", label: "Charts" }]);
    expect(TAB_ORDER.some((tab) => tab.id === "overview" || tab.id === "calendar" || tab.id === "dashboard")).toBe(false);
  });

  it("keeps every retained page reachable from the prototype drawer", () => {
    const html = renderToStaticMarkup(<PrototypingTab onNavigate={() => {}} />);

    expect(html).toContain("Garbage Drawer");
    expect(html).toContain("Ignore");
    expect(html).toContain("Six Questions Draft");
    expect(html).toContain("WIP Map Archive");
    expect(html).toContain("Strength Meter");
    expect(html).toContain("Deprecated Overview");
    expect(html).toContain("Differential Calculator");
    expect(html).toContain("Overview Prototype");
    expect(html).toContain("Macro Drivers");
    expect(html).toContain("Event Replay");
    expect(html).toContain("Central Banks");
    expect(html).not.toContain("Legacy Overview");
    expect(html).not.toContain("Event replay, reaction studies, and calendar prep tools.");
    expect(html).not.toContain(">Event Tools<");
  });

});
