export const fundamentalSettingsEvent = 'fyodor:fundamental-settings'
export type FundamentalSettingsRequest = { family?: string; toggle?: boolean; model?:'legacy'|'r1' }

export function openFundamentalSettings(family?: string,model:'legacy'|'r1'='legacy') {
  window.dispatchEvent(new window.CustomEvent(fundamentalSettingsEvent, { detail: { family,model } }))
}

export function toggleFundamentalSettings() {
  window.dispatchEvent(new window.CustomEvent(fundamentalSettingsEvent, { detail: { toggle: true } }))
}
