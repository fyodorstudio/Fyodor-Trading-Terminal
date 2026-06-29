# Config Map

Configuration files are static app metadata. Prefer editing these instead of hardcoding repeated labels/options in components.

- `navigation.ts` - top-level tabs and Specialist Tools children.
- `themeConfig.ts` - hidden Aesthetic Forge font/color options used by the persisted theme plumbing.
- `fxPairs.ts` - supported FX pair list and helpers.
- `currencyConfig.ts` - currency/country metadata and central-bank mapping support.
- `terminology.ts` - shared trust/status wording.

Do not add live-data source configuration here unless the product boundary changes explicitly.
