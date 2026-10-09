export const fundamentalSettingsEvent = 'fyodor:fundamental-settings'

export function openFundamentalSettings(family?: string) {
  window.dispatchEvent(new window.CustomEvent(fundamentalSettingsEvent, { detail: { family } }))
}
