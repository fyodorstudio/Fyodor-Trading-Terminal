import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FlagIcon } from "@/app/components/FlagIcon";

describe("FlagIcon", () => {
  it("renders the world-flags component inside the app wrapper", () => {
    const html = renderToStaticMarkup(<FlagIcon countryCode="US" />);

    expect(html).toContain("object-cover");
    expect(html).toContain("scale-110");
  });

  it("falls back to the country code when the input is not a two-letter code", () => {
    const html = renderToStaticMarkup(<FlagIcon countryCode="" />);

    expect(html).toContain("--");
  });
});
