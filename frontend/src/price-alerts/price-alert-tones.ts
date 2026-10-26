export type PriceAlertSoundId = 'thin' | 'bell' | 'double-beep' | 'digital' | 'soft-chime'

type Tone = { offset: number; duration: number; frequency: number; waveform: OscillatorType; volume: number }
type AlertSound = { id: PriceAlertSoundId; label: string; interval: number; tones: Tone[] }

// Original synthesized sounds; all presets work offline and share the duration control.
export const priceAlertSounds: AlertSound[] = [
  { id: 'thin', label: 'Thin', interval: 1, tones: [
    { offset: 0, duration: .4, frequency: 1760, waveform: 'sine', volume: .12 },
    { offset: .5, duration: .4, frequency: 2093, waveform: 'sine', volume: .12 },
  ] },
  { id: 'bell', label: 'Bell', interval: 1, tones: [
    { offset: 0, duration: .9, frequency: 880, waveform: 'sine', volume: .12 },
    { offset: 0, duration: .7, frequency: 1760, waveform: 'sine', volume: .035 },
  ] },
  { id: 'double-beep', label: 'Double beep', interval: .9, tones: [
    { offset: 0, duration: .13, frequency: 1046, waveform: 'sine', volume: .12 },
    { offset: .2, duration: .13, frequency: 1046, waveform: 'sine', volume: .12 },
  ] },
  { id: 'digital', label: 'Digital', interval: .6, tones: [
    { offset: 0, duration: .14, frequency: 880, waveform: 'square', volume: .035 },
    { offset: .18, duration: .14, frequency: 1320, waveform: 'square', volume: .035 },
  ] },
  { id: 'soft-chime', label: 'Soft chime', interval: 1.5, tones: [
    { offset: 0, duration: .6, frequency: 523, waveform: 'sine', volume: .07 },
    { offset: .25, duration: .65, frequency: 659, waveform: 'sine', volume: .07 },
    { offset: .5, duration: .8, frequency: 784, waveform: 'sine', volume: .07 },
  ] },
]
