import type { CentralBankMappingRule } from "@/app/types";

export const CENTRAL_BANK_RULES: CentralBankMappingRule[] = [
  {
    currency: "USD",
    countryCode: "US",
    bankName: "Federal Reserve",
    flag: "US",
    policyRate: {
      exactTitles: ["Fed Interest Rate Decision", "FOMC Interest Rate Decision", "Interest Rate Decision"],
      includeAll: [["fed", "interest", "rate"], ["fomc", "interest", "rate"], ["federal", "funds", "rate"]],
      excludeAny: ["mortgage", "loan", "auction", "bill"],
    },
    inflation: {
      exactTitles: ["Inflation Rate YoY", "Consumer Price Index (YoY)"],
      includeAll: [["inflation", "rate", "yoy"], ["cpi", "yoy"], ["consumer", "price", "index", "yoy"]],
      excludeAny: ["core", "trimmed", "median", "services", "producer", "ppi"],
    },
  },
  {
    currency: "EUR",
    countryCode: "EU",
    bankName: "European Central Bank",
    flag: "EU",
    policyRate: {
      exactTitles: ["ECB Interest Rate Decision", "Main Refinancing Rate", "Deposit Facility Rate"],
      includeAll: [["ecb", "interest", "rate"], ["main", "refinancing", "rate"], ["deposit", "facility", "rate"]],
      excludeAny: ["auction", "bond"],
    },
    inflation: {
      exactTitles: ["Inflation Rate YoY", "Inflation Rate YoY Flash", "Inflation Rate YoY Final", "HICP YoY"],
      includeAll: [["inflation", "rate", "yoy"], ["hicp", "yoy"]],
      excludeAny: ["core", "services", "ppi"],
    },
  },
  {
    currency: "GBP",
    countryCode: "GB",
    bankName: "Bank of England",
    flag: "GB",
    policyRate: {
      exactTitles: ["BoE Interest Rate Decision", "Official Bank Rate"],
      includeAll: [["boe", "interest", "rate"], ["official", "bank", "rate"]],
      excludeAny: ["mortgage", "loan"],
    },
    inflation: {
      exactTitles: ["Inflation Rate YoY", "Consumer Price Index (YoY)"],
      includeAll: [["inflation", "rate", "yoy"], ["consumer", "price", "index", "yoy"], ["cpi", "yoy"]],
      excludeAny: ["core", "input", "output", "ppi"],
    },
  },
  {
    currency: "JPY",
    countryCode: "JP",
    bankName: "Bank of Japan",
    flag: "JP",
    policyRate: {
      exactTitles: ["BoJ Interest Rate Decision", "BoJ Policy Rate"],
      includeAll: [["boj", "interest", "rate"], ["boj", "policy", "rate"]],
      excludeAny: ["loan"],
    },
    inflation: {
      exactTitles: ["Inflation Rate YoY", "National CPI (YoY)"],
      includeAll: [["inflation", "rate", "yoy"], ["national", "cpi", "yoy"], ["cpi", "yoy"]],
      excludeAny: ["core", "tokyo", "ppi"],
    },
  },
  {
    currency: "AUD",
    countryCode: "AU",
    bankName: "Reserve Bank of Australia",
    flag: "AU",
    policyRate: {
      exactTitles: ["RBA Interest Rate Decision", "Interest Rate Decision"],
      includeAll: [["rba", "interest", "rate"], ["reserve", "bank", "australia", "interest", "rate"]],
      excludeAny: ["loan"],
    },
    inflation: {
      exactTitles: ["Inflation Rate YoY", "CPI YoY"],
      includeAll: [["inflation", "rate", "yoy"], ["cpi", "yoy"]],
      excludeAny: ["trimmed", "weighted", "core", "ppi"],
    },
  },
  {
    currency: "CAD",
    countryCode: "CA",
    bankName: "Bank of Canada",
    flag: "CA",
    policyRate: {
      exactTitles: ["BoC Interest Rate Decision", "Interest Rate Decision"],
      includeAll: [["boc", "interest", "rate"], ["bank", "canada", "interest", "rate"]],
      excludeAny: ["mortgage", "bond"],
    },
    inflation: {
      exactTitles: ["Inflation Rate YoY", "CPI YoY"],
      includeAll: [["inflation", "rate", "yoy"], ["cpi", "yoy"]],
      excludeAny: ["core", "median", "trimmed", "ppi"],
    },
  },
  {
    currency: "NZD",
    countryCode: "NZ",
    bankName: "Reserve Bank of New Zealand",
    flag: "NZ",
    policyRate: {
      exactTitles: ["RBNZ Interest Rate Decision", "Official Cash Rate"],
      includeAll: [["rbnz", "interest", "rate"], ["official", "cash", "rate"]],
      excludeAny: ["loan"],
    },
    inflation: {
      exactTitles: ["Inflation Rate YoY", "CPI YoY"],
      includeAll: [["inflation", "rate", "yoy"], ["cpi", "yoy"]],
      excludeAny: ["core", "ppi"],
    },
  },
  {
    currency: "CHF",
    countryCode: "CH",
    bankName: "Swiss National Bank",
    flag: "CH",
    policyRate: {
      exactTitles: ["SNB Interest Rate Decision", "SNB Policy Rate"],
      includeAll: [["snb", "interest", "rate"], ["snb", "policy", "rate"]],
      excludeAny: ["mortgage"],
    },
    inflation: {
      exactTitles: ["Inflation Rate YoY", "CPI YoY"],
      includeAll: [["inflation", "rate", "yoy"], ["cpi", "yoy"]],
      excludeAny: ["core", "ppi"],
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
