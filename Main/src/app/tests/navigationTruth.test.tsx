import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ANALYSIS_TAB_ORDER, TAB_ORDER } from "@/app/App";
import { PrototypingTab } from "@/app/tabs/PrototypingTab";
import { TerminalQuestionsTab } from "@/app/tabs/TerminalQuestionsTab";

describe("navigation truth", () => {
  it("promotes Event Replay as a direct Specialist Tools child", () => {
    expect(ANALYSIS_TAB_ORDER).toContainEqual({ id: "event-tools", label: "EVENT REPLAY" });

    const specialist = TAB_ORDER.find((tab) => tab.id === "dashboard");
    expect(specialist?.children).toContainEqual({ id: "event-tools", label: "EVENT REPLAY" });
  });

  it("does not list Event Tools as an older prototype/legacy tool", () => {
    const html = renderToStaticMarkup(<PrototypingTab onNavigate={() => {}} />);

    expect(html).toContain("Older Tools");
    expect(html).toContain("Strength Meter");
    expect(html).toContain("Differential Calculator");
    expect(html).toContain("Legacy Overview");
    expect(html).not.toContain("Event replay, reaction studies, and calendar prep tools.");
    expect(html).not.toContain(">Event Tools<");
  });

  it("marks Event Replay as the primary event-risk specialist route", () => {
    const html = renderToStaticMarkup(<TerminalQuestionsTab onNavigate={() => {}} />);

    expect(html).toContain("Is event risk close enough to invalidate a clean setup?");
    expect(html).toContain("Open Event Replay");
    expect(html).not.toContain("Open Event Tools");
  });
});
