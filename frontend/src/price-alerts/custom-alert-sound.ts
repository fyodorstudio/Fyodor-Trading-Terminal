export const customAlertSoundKey = 'fyodor.price-alert-custom-sound.v1'
export const customAlertSoundMaxBytes = 2 * 1024 * 1024
export type CustomAlertSound = { name: string; data: string }

export function readCustomAlertSound(): CustomAlertSound | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(customAlertSoundKey) ?? 'null')
    return value && typeof value.name === 'string' && typeof value.data === 'string'
      && value.data.length > 0 && value.data.length <= Math.ceil(customAlertSoundMaxBytes / 3) * 4
      && /^[A-Za-z0-9+/]+={0,2}$/.test(value.data) ? { name: value.name, data: value.data } : null
  } catch { return null }
}

export function encodeCustomAlertSound(bytes: ArrayBuffer) {
  const data = new Uint8Array(bytes)
  let binary = ''
  for (let offset = 0; offset < data.length; offset += 8192) binary += String.fromCharCode(...data.subarray(offset, offset + 8192))
  return window.btoa(binary)
}

export function decodeCustomAlertSound(data: string) {
  return Uint8Array.from(window.atob(data), character => character.charCodeAt(0)).buffer
}

export function saveCustomAlertSound(value: CustomAlertSound) {
  try { window.localStorage.setItem(customAlertSoundKey, JSON.stringify(value)); return true }
  catch { return false }
}
