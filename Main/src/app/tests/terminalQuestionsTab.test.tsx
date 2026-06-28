import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TerminalQuestionsTab } from "@/app/tabs/garbage/TerminalQuestionsTab";

describe("TerminalQuestionsTab", () => {
  it("renders the six product questions and navigation labels", () => {
    const html = renderToStaticMarkup(<TerminalQuestionsTab onNavigate={() => {}} />);

    expect(html).toContain("SIX QUESTIONS");
    expect(html).toContain("Deprecated Draft");
    expect(html).toContain("historical routing context");
    expect(html).toContain("Can I trust the app right now?");
    expect(html).toContain("What deserves attention right now?");
    expect(html).toContain("Is the macro backdrop supportive, hostile, or unclear?");
    expect(html).toContain("Is event risk close enough to invalidate a clean setup?");
    expect(html).toContain("Which side is winning, and why?");
    expect(html).toContain("Should I watch, study, prepare, wait, or ignore?");
    expect(html).toContain("Open Watchlist");
    expect(html).toContain("Audit Calendar");
    expect(html).toContain("Open Event Replay");
    expect(html).toContain("Prototype");
    expect(html).toContain("Deprecated");
    expect(html).not.toContain("Open Event Tools");
  });
});
