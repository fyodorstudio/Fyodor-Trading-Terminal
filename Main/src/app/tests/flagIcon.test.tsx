import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FlagIcon } from "@/app/components/FlagIcon";

describe("FlagIcon", () => {
  it("renders a local flag glyph without the external flag bundle", () => {
    const html = renderToStaticMarkup(<FlagIcon countryCode="US" />);

    expect(html).toContain("aria-hidden");
    expect(html).not.toContain("react-world-flags");
  });

  it("falls back to the country code when the input is not a two-letter code", () => {
    const html = renderToStaticMarkup(<FlagIcon countryCode="" />);

    expect(html).toContain("--");
  });
});
