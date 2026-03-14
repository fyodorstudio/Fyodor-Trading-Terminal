import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CentralBanksTab } from "@/app/tabs/CentralBanksTab";
import type { CentralBankSnapshot } from "@/app/types";

describe("CentralBanksTab", () => {
  it("renders N/A for missing values", () => {
    const snapshot: CentralBankSnapshot = {
      currency: "USD",
      countryCode: "US",
      bankName: "Federal Reserve",
      flag: "US",
      currentPolicyRate: null,
      previousPolicyRate: null,
      currentInflationRate: null,
      previousInflationRate: null,
      lastRateReleaseAt: null,
      lastCpiReleaseAt: null,
      nextRateEventAt: null,
      nextRateEventTitle: null,
      nextCpiEventAt: null,
      nextCpiEventTitle: null,
      status: "missing",
      notes: [],
    };

    const html = renderToStaticMarkup(
      <CentralBanksTab
        snapshots={[snapshot]}
        logs={[]}
        status="no_data"
        lastCalendarIngestAt={null}
      />,
    );

    expect(html).toContain("N/A");
    expect(html).toContain("Federal Reserve");
  });
});
