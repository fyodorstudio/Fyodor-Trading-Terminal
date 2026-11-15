import type { NewsSettings } from './model'

let context: AudioContext | null = null
const tones = { chime: [660, 880], bell: [1047], pulse: [440, 440, 440] }

export async function enableNewsSound() {
  try {
    context ??= new AudioContext()
    if (context.state !== 'running') await context.resume()
    return context.state === 'running'
  } catch { return false }
}

export function playNewsSound(sound: NewsSettings['sound']) {
  if (!context || context.state !== 'running') return false
  const start = context.currentTime
  tones[sound].forEach((frequency, index) => {
    const oscillator = context!.createOscillator(), gain = context!.createGain(), at = start + index * .16
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, at)
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.14, at + .01)
    gain.gain.exponentialRampToValueAtTime(.001, at + .3)
    oscillator.connect(gain); gain.connect(context!.destination)
    oscillator.start(at); oscillator.stop(at + .31)
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
  })
  return true
}
