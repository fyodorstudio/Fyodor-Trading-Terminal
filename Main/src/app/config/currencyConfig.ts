import type { CentralBankMappingRule } from "@/app/types";

export const CENTRAL_BANK_RULES: CentralBankMappingRule[] = [
  {
    currency: "USD",
    countryCode: "US",
    bankName: "Federal Reserve",
    flag: "US",
    policyRate: {
      primary: {
        exactTitles: ["Fed Interest Rate Decision", "FOMC Interest Rate Decision"],
        includeAll: [["fed", "interest", "rate"], ["fomc", "interest", "rate"]],
        excludeAny: ["mortgage", "loan", "auction", "bill"],
      },
    },
    inflation: {
      primary: {
        exactTitles: ["CPI y/y"],
        includeAll: [["cpi", "y", "y"]],
        excludeAny: ["core", "trimmed", "median", "services", "producer", "ppi", "expectation", "pce"],
      },
    },
  },
  {
    currency: "EUR",
    countryCode: "EU",
    bankName: "European Central Bank",
    flag: "EU",
    policyRate: {
      primary: {
        exactTitles: ["ECB Interest Rate Decision"],
        includeAll: [["ecb", "interest", "rate"]],
        excludeAny: ["auction", "bond"],
      },
    },
    inflation: {
      primary: {
        exactTitles: ["HICP y/y"],
        includeAll: [["hicp", "y", "y"]],
        excludeAny: ["core", "services", "ppi", "tobacco", "energy", "food"],
      },
      fallback: {
        exactTitles: ["CPI y/y"],
        includeAll: [["cpi", "y", "y"]],
        excludeAny: ["core", "services", "ppi", "tobacco", "energy", "food"],
      },
    },
  },
  {
    currency: "GBP",
    countryCode: "GB",
    bankName: "Bank of England",
    flag: "GB",
    policyRate: {
      primary: {
        exactTitles: ["BoE Interest Rate Decision"],
        includeAll: [["boe", "interest", "rate"]],
        excludeAny: ["mortgage", "loan"],
      },
    },
    inflation: {
      primary: {
        exactTitles: ["CPI y/y"],
        includeAll: [["cpi", "y", "y"]],
        excludeAny: ["core", "input", "output", "ppi", "house"],
      },
      fallback: {
        exactTitles: ["CPIH y/y"],
        includeAll: [["cpih", "y", "y"]],
        excludeAny: ["core", "input", "output", "ppi", "house"],
      },
    },
  },
  {
    currency: "JPY",
    countryCode: "JP",
    bankName: "Bank of Japan",
    flag: "JP",
    policyRate: {
      primary: {
        exactTitles: ["BoJ Interest Rate Decision"],
        includeAll: [["boj", "interest", "rate"]],
        excludeAny: ["loan"],
      },
    },
    inflation: {
      primary: {
        exactTitles: ["CPI y/y"],
        includeAll: [["cpi", "y", "y"]],
        excludeAny: ["core", "tokyo", "ppi", "trimmed", "weighted", "excl"],
      },
    },
  },
  {
    currency: "AUD",
    countryCode: "AU",
    bankName: "Reserve Bank of Australia",
    flag: "AU",
    policyRate: {
      primary: {
        exactTitles: ["RBA Interest Rate Decision"],
        includeAll: [["rba", "interest", "rate"]],
        excludeAny: ["loan"],
      },
    },
    inflation: {
      primary: {
        exactTitles: ["CPI y/y"],
        includeAll: [["cpi", "y", "y"]],
        excludeAny: ["trimmed", "weighted", "core", "ppi"],
      },
    },
  },
  {
    currency: "CAD",
    countryCode: "CA",
    bankName: "Bank of Canada",
    flag: "CA",
    policyRate: {
      primary: {
        exactTitles: ["BoC Interest Rate Decision"],
        includeAll: [["boc", "interest", "rate"]],
        excludeAny: ["mortgage", "bond"],
      },
    },
    inflation: {
      primary: {
        exactTitles: ["CPI y/y"],
        includeAll: [["cpi", "y", "y"]],
        excludeAny: ["core", "median", "trimmed", "ppi", "common"],
      },
    },
  },
  {
    currency: "NZD",
    countryCode: "NZ",
    bankName: "Reserve Bank of New Zealand",
    flag: "NZ",
    policyRate: {
      primary: {
        exactTitles: ["RBNZ Interest Rate Decision"],
        includeAll: [["rbnz", "interest", "rate"]],
        excludeAny: ["loan"],
      },
    },
    inflation: {
      primary: {
        exactTitles: ["CPI y/y"],
        includeAll: [["cpi", "y", "y"]],
        excludeAny: ["core", "ppi", "food", "price", "commodity"],
      },
    },
  },
  {
    currency: "CHF",
    countryCode: "CH",
    bankName: "Swiss National Bank",
    flag: "CH",
    policyRate: {
      primary: {
        exactTitles: ["SNB Interest Rate Decision"],
        includeAll: [["snb", "interest", "rate"]],
        excludeAny: ["mortgage"],
      },
    },
    inflation: {
      primary: {
        exactTitles: ["CPI y/y"],
        includeAll: [["cpi", "y", "y"]],
        excludeAny: ["core", "ppi"],
      },
    },
  },
];

export const CENTRAL_BANK_COUNTRY_NAME: Record<string, string> = {
  US: "United States",
  EU: "Euro Area",
  GB: "United Kingdom",
  JP: "Japan",
  AU: "Australia",
  CA: "Canada",
  NZ: "New Zealand",
  CH: "Switzerland",
};
