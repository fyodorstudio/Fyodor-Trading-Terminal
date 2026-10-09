export const fundamentalSettingsEvent = 'fyodor:fundamental-settings'
export type FundamentalSettingsRequest = { family?: string; toggle?: boolean }

export function openFundamentalSettings(family?: string) {
  window.dispatchEvent(new window.CustomEvent(fundamentalSettingsEvent, { detail: { family } }))
}

export function toggleFundamentalSettings() {
  window.dispatchEvent(new window.CustomEvent(fundamentalSettingsEvent, { detail: { toggle: true } }))
}
