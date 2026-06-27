import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ANALYSIS_TAB_ORDER, TAB_ORDER } from "@/app/App";
import { PrototypingTab } from "@/app/tabs/secondary/PrototypingTab";
import { TerminalQuestionsTab } from "@/app/tabs/secondary/TerminalQuestionsTab";

describe("navigation truth", () => {
  it("promotes Event Replay as a direct Specialist Tools child", () => {
    expect(ANALYSIS_TAB_ORDER).toEqual([
      { id: "event-tools", label: "EVENT REPLAY", groupLabel: "Active Experiment" },
      { id: "prototyping", label: "PROTOTYPING", groupLabel: "Archived / Ignore" },
    ]);
    expect(ANALYSIS_TAB_ORDER).not.toContainEqual({ id: "terminal-questions", label: "SIX QUESTIONS DRAFT" });
    expect(ANALYSIS_TAB_ORDER).not.toContainEqual({ id: "work-in-progress", label: "WIP MAP ARCHIVE" });

    const specialist = TAB_ORDER.find((tab) => tab.id === "dashboard");
    expect(specialist?.children).toContainEqual({ id: "event-tools", label: "EVENT REPLAY", groupLabel: "Active Experiment" });
    expect(specialist?.children).toContainEqual({ id: "prototyping", label: "PROTOTYPING", groupLabel: "Archived / Ignore" });
  });

  it("moves old planning drafts into the prototyping archive", () => {
    const html = renderToStaticMarkup(<PrototypingTab onNavigate={() => {}} />);

    expect(html).toContain("Archived / Ignore");
    expect(html).toContain("Six Questions Draft");
    expect(html).toContain("WIP Map Archive");
    expect(html).toContain("Older Tools");
    expect(html).toContain("Strength Meter");
    expect(html).toContain("Differential Calculator");
    expect(html).toContain("Deprecated Overview");
    expect(html).not.toContain("Legacy Overview");
    expect(html).not.toContain("Event replay, reaction studies, and calendar prep tools.");
    expect(html).not.toContain(">Event Tools<");
  });

  it("marks Event Replay as the primary event-risk specialist route", () => {
    const html = renderToStaticMarkup(<TerminalQuestionsTab onNavigate={() => {}} />);

    expect(html).toContain("Is event risk close enough to invalidate a clean setup?");
    expect(html).toContain("Deprecated Draft");
    expect(html).toContain("Open Event Replay");
    expect(html).not.toContain("Open Event Tools");
  });
});
