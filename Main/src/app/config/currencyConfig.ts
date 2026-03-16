import type { CentralBankMappingRule } from "@/app/types";

export const MAJOR_COUNTRY_CODES = ["US", "EU", "GB", "JP", "AU", "CA", "NZ", "CH"] as const;

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

const REGION_NAMES =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

export function getCountryDisplayName(countryCode: string): string {
  const code = countryCode.trim().toUpperCase();
  if (!code) return "Unknown";
  return CENTRAL_BANK_COUNTRY_NAME[code] ?? REGION_NAMES?.of(code) ?? code;
}

export const CENTRAL_BANK_RULES: CentralBankMappingRule[] = [
  {
    currency: "USD",
    countryCode: "US",
    bankName: "Federal Reserve",
    flag: "US",
    policyRate: {
      current: {
        matcher: {
          primary: {
            exactTitles: ["Fed Interest Rate Decision", "FOMC Interest Rate Decision"],
            includeAll: [["fed", "interest", "rate"], ["fomc", "interest", "rate"]],
            excludeAny: ["mortgage", "loan", "auction", "bill"],
          },
        },
        countryCodes: ["US"],
      },
      nextSchedule: {
        matcher: {
          primary: {
            exactTitles: ["Fed Interest Rate Decision", "FOMC Interest Rate Decision"],
            includeAll: [["fed", "interest", "rate"], ["fomc", "interest", "rate"]],
            excludeAny: ["mortgage", "loan", "auction", "bill"],
          },
          fallback: {
            exactTitles: ["FOMC Statement"],
            includeAll: [["fomc", "statement"]],
            excludeAny: ["minutes", "loan", "speech"],
          },
        },
        countryCodes: ["US"],
      },
    },
    inflation: {
      current: {
        matcher: {
          primary: {
            exactTitles: ["CPI y/y"],
            includeAll: [["cpi", "y", "y"]],
            excludeAny: ["core", "trimmed", "median", "services", "producer", "ppi", "expectation", "pce"],
          },
        },
        countryCodes: ["US"],
      },
      nextSchedule: {
        matcher: {
          primary: {
            exactTitles: ["CPI y/y"],
            includeAll: [["cpi", "y", "y"]],
            excludeAny: ["core", "trimmed", "median", "services", "producer", "ppi", "expectation", "pce"],
          },
        },
        countryCodes: ["US"],
      },
    },
  },
  {
    currency: "EUR",
    countryCode: "EU",
    bankName: "European Central Bank",
    flag: "EU",
    policyRate: {
      current: {
        matcher: {
          primary: {
            exactTitles: ["ECB Deposit Facility Rate Decision"],
            includeAll: [["ecb", "deposit", "facility", "rate", "decision"]],
            excludeAny: ["auction", "bond"],
          },
          fallback: {
            exactTitles: ["ECB Interest Rate Decision"],
            includeAll: [["ecb", "interest", "rate"]],
            excludeAny: ["auction", "bond"],
          },
        },
        countryCodes: ["EU"],
      },
      nextSchedule: {
        matcher: {
          primary: {
            exactTitles: ["ECB Deposit Facility Rate Decision", "ECB Interest Rate Decision"],
            includeAll: [["ecb", "interest", "rate"], ["ecb", "deposit", "facility", "rate"]],
            excludeAny: ["auction", "bond"],
          },
          fallback: {
            exactTitles: ["ECB Monetary Policy Statement", "ECB Monetary Policy Press Conference"],
            includeAll: [["ecb", "monetary", "policy"], ["ecb", "press", "conference"]],
            excludeAny: ["accounts", "non monetary"],
          },
        },
        countryCodes: ["EU"],
      },
    },
    inflation: {
      current: {
        matcher: {
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
        countryCodes: ["EU"],
      },
      nextSchedule: {
        matcher: {
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
        countryCodes: ["EU"],
      },
    },
  },
  {
    currency: "GBP",
    countryCode: "GB",
    bankName: "Bank of England",
    flag: "GB",
    policyRate: {
      current: {
        matcher: {
          primary: {
            exactTitles: ["BoE Interest Rate Decision"],
            includeAll: [["boe", "interest", "rate"]],
            excludeAny: ["mortgage", "loan"],
          },
        },
        countryCodes: ["GB"],
      },
      nextSchedule: {
        matcher: {
          primary: {
            exactTitles: ["BoE Interest Rate Decision"],
            includeAll: [["boe", "interest", "rate"]],
            excludeAny: ["mortgage", "loan"],
          },
          fallback: {
            exactTitles: ["BoE Monetary Policy Report"],
            includeAll: [["boe", "monetary", "policy", "report"]],
            excludeAny: ["credit", "liabilities"],
          },
        },
        countryCodes: ["GB"],
      },
    },
    inflation: {
      current: {
        matcher: {
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
        countryCodes: ["GB"],
      },
      nextSchedule: {
        matcher: {
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
        countryCodes: ["GB"],
      },
    },
  },
  {
    currency: "JPY",
    countryCode: "JP",
    bankName: "Bank of Japan",
    flag: "JP",
    policyRate: {
      current: {
        matcher: {
          primary: {
            exactTitles: ["BoJ Interest Rate Decision"],
            includeAll: [["boj", "interest", "rate"]],
            excludeAny: ["loan"],
          },
        },
        countryCodes: ["JP"],
      },
      nextSchedule: {
        matcher: {
          primary: {
            exactTitles: ["BoJ Interest Rate Decision"],
            includeAll: [["boj", "interest", "rate"]],
            excludeAny: ["loan"],
          },
          fallback: {
            exactTitles: ["BoJ Monetary Policy Statement"],
            includeAll: [["boj", "monetary", "policy", "statement"]],
            excludeAny: ["minutes", "summary"],
          },
        },
        countryCodes: ["JP"],
      },
    },
    inflation: {
      current: {
        matcher: {
          primary: {
            exactTitles: ["CPI y/y"],
            includeAll: [["cpi", "y", "y"]],
            excludeAny: ["core", "tokyo", "ppi", "trimmed", "weighted", "excl"],
          },
        },
        countryCodes: ["JP"],
      },
      nextSchedule: {
        matcher: {
          primary: {
            exactTitles: ["CPI y/y"],
            includeAll: [["cpi", "y", "y"]],
            excludeAny: ["core", "tokyo", "ppi", "trimmed", "weighted", "excl"],
          },
        },
        countryCodes: ["JP"],
      },
    },
  },
  {
    currency: "AUD",
    countryCode: "AU",
    bankName: "Reserve Bank of Australia",
    flag: "AU",
    policyRate: {
      current: {
        matcher: {
          primary: {
            exactTitles: ["RBA Interest Rate Decision"],
            includeAll: [["rba", "interest", "rate"]],
            excludeAny: ["loan"],
          },
        },
        countryCodes: ["AU"],
      },
      nextSchedule: {
        matcher: {
          primary: {
            exactTitles: ["RBA Interest Rate Decision"],
            includeAll: [["rba", "interest", "rate"]],
            excludeAny: ["loan"],
          },
          fallback: {
            exactTitles: ["RBA Rate Statement", "RBA Monetary Policy Statement"],
            includeAll: [["rba", "rate", "statement"], ["rba", "monetary", "policy", "statement"]],
            excludeAny: ["chart", "trimmed", "weighted"],
          },
        },
        countryCodes: ["AU"],
      },
    },
    inflation: {
      current: {
        matcher: {
          primary: {
            exactTitles: ["Monthly CPI Indicator y/y"],
            includeAll: [["monthly", "cpi", "indicator", "y", "y"]],
            excludeAny: ["trimmed", "weighted", "core", "ppi"],
          },
          fallback: {
            exactTitles: ["CPI y/y"],
            includeAll: [["cpi", "y", "y"]],
            excludeAny: ["trimmed", "weighted", "core", "ppi"],
          },
        },
        countryCodes: ["AU"],
      },
      nextSchedule: {
        matcher: {
          primary: {
            exactTitles: ["Monthly CPI Indicator y/y"],
            includeAll: [["monthly", "cpi", "indicator", "y", "y"]],
            excludeAny: ["trimmed", "weighted", "core", "ppi"],
          },
          fallback: {
            exactTitles: ["CPI y/y"],
            includeAll: [["cpi", "y", "y"]],
            excludeAny: ["trimmed", "weighted", "core", "ppi"],
          },
        },
        countryCodes: ["AU"],
      },
    },
  },
  {
    currency: "CAD",
    countryCode: "CA",
    bankName: "Bank of Canada",
    flag: "CA",
    policyRate: {
      current: {
        matcher: {
          primary: {
            exactTitles: ["BoC Interest Rate Decision"],
            includeAll: [["boc", "interest", "rate"]],
            excludeAny: ["mortgage", "bond"],
          },
        },
        countryCodes: ["CA"],
      },
      nextSchedule: {
        matcher: {
          primary: {
            exactTitles: ["BoC Interest Rate Decision"],
            includeAll: [["boc", "interest", "rate"]],
            excludeAny: ["mortgage", "bond"],
          },
          fallback: {
            exactTitles: ["BoC Rate Statement", "BoC Monetary Policy Report"],
            includeAll: [["boc", "rate", "statement"], ["boc", "monetary", "policy", "report"]],
            excludeAny: ["business", "outlook"],
          },
        },
        countryCodes: ["CA"],
      },
    },
    inflation: {
      current: {
        matcher: {
          primary: {
            exactTitles: ["CPI y/y"],
            includeAll: [["cpi", "y", "y"]],
            excludeAny: ["core", "median", "trimmed", "ppi", "common"],
          },
        },
        countryCodes: ["CA"],
      },
      nextSchedule: {
        matcher: {
          primary: {
            exactTitles: ["CPI y/y"],
            includeAll: [["cpi", "y", "y"]],
            excludeAny: ["core", "median", "trimmed", "ppi", "common"],
          },
        },
        countryCodes: ["CA"],
      },
    },
  },
  {
    currency: "NZD",
    countryCode: "NZ",
    bankName: "Reserve Bank of New Zealand",
    flag: "NZ",
    policyRate: {
      current: {
        matcher: {
          primary: {
            exactTitles: ["RBNZ Interest Rate Decision"],
            includeAll: [["rbnz", "interest", "rate"]],
            excludeAny: ["loan"],
          },
        },
        countryCodes: ["NZ"],
      },
      nextSchedule: {
        matcher: {
          primary: {
            exactTitles: ["RBNZ Interest Rate Decision"],
            includeAll: [["rbnz", "interest", "rate"]],
            excludeAny: ["loan"],
          },
          fallback: {
            exactTitles: ["RBNZ Rate Statement", "RBNZ Monetary Policy Statement"],
            includeAll: [["rbnz", "rate", "statement"], ["rbnz", "monetary", "policy", "statement"]],
            excludeAny: ["expectations", "stability", "speech"],
          },
        },
        countryCodes: ["NZ"],
      },
    },
    inflation: {
      current: {
        matcher: {
          primary: {
            exactTitles: ["CPI y/y"],
            includeAll: [["cpi", "y", "y"]],
            excludeAny: ["core", "ppi", "food", "price", "commodity"],
          },
        },
        countryCodes: ["NZ"],
      },
      nextSchedule: {
        matcher: {
          primary: {
            exactTitles: ["CPI y/y"],
            includeAll: [["cpi", "y", "y"]],
            excludeAny: ["core", "ppi", "food", "price", "commodity"],
          },
        },
        countryCodes: ["NZ"],
      },
    },
  },
  {
    currency: "CHF",
    countryCode: "CH",
    bankName: "Swiss National Bank",
    flag: "CH",
    policyRate: {
      current: {
        matcher: {
          primary: {
            exactTitles: ["SNB Interest Rate Decision"],
            includeAll: [["snb", "interest", "rate"]],
            excludeAny: ["mortgage"],
          },
        },
        countryCodes: ["CH"],
      },
      nextSchedule: {
        matcher: {
          primary: {
            exactTitles: ["SNB Interest Rate Decision"],
            includeAll: [["snb", "interest", "rate"]],
            excludeAny: ["mortgage"],
          },
          fallback: {
            exactTitles: ["SNB Monetary Policy Assessment"],
            includeAll: [["snb", "monetary", "policy", "assessment"]],
            excludeAny: ["stability", "speech"],
          },
        },
        countryCodes: ["CH"],
      },
    },
    inflation: {
      current: {
        matcher: {
          primary: {
            exactTitles: ["CPI y/y"],
            includeAll: [["cpi", "y", "y"]],
            excludeAny: ["core", "ppi"],
          },
        },
        countryCodes: ["CH"],
      },
      nextSchedule: {
        matcher: {
          primary: {
            exactTitles: ["CPI y/y"],
            includeAll: [["cpi", "y", "y"]],
            excludeAny: ["core", "ppi"],
          },
        },
        countryCodes: ["CH"],
      },
    },
  },
];
