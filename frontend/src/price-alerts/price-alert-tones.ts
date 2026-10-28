export type PriceAlertSoundId = 'thin' | 'bell' | 'double-beep' | 'digital' | 'soft-chime'
  | 'pulse' | 'triple-beep' | 'doorbell' | 'rising-chime' | 'falling-chime' | 'sonar' | 'buzzer' | 'custom'

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
  { id: 'pulse', label: 'Pulse', interval: .7, tones: [
    { offset: 0, duration: .3, frequency: 440, waveform: 'triangle', volume: .12 },
  ] },
  { id: 'triple-beep', label: 'Triple beep', interval: 1.2, tones: [
    { offset: 0, duration: .1, frequency: 1175, waveform: 'sine', volume: .1 },
    { offset: .18, duration: .1, frequency: 1175, waveform: 'sine', volume: .1 },
    { offset: .36, duration: .1, frequency: 1175, waveform: 'sine', volume: .1 },
  ] },
  { id: 'doorbell', label: 'Doorbell', interval: 1.6, tones: [
    { offset: 0, duration: .7, frequency: 784, waveform: 'sine', volume: .12 },
    { offset: .5, duration: .9, frequency: 622, waveform: 'sine', volume: .1 },
  ] },
  { id: 'rising-chime', label: 'Rising chime', interval: 1.2, tones: [
    { offset: 0, duration: .35, frequency: 659, waveform: 'triangle', volume: .09 },
    { offset: .2, duration: .35, frequency: 880, waveform: 'triangle', volume: .09 },
    { offset: .4, duration: .5, frequency: 1319, waveform: 'triangle', volume: .09 },
  ] },
  { id: 'falling-chime', label: 'Falling chime', interval: 1.4, tones: [
    { offset: 0, duration: .45, frequency: 1047, waveform: 'sine', volume: .1 },
    { offset: .25, duration: .45, frequency: 784, waveform: 'sine', volume: .1 },
    { offset: .5, duration: .65, frequency: 523, waveform: 'sine', volume: .1 },
  ] },
  { id: 'sonar', label: 'Sonar', interval: 1.8, tones: [
    { offset: 0, duration: 1.1, frequency: 1397, waveform: 'sine', volume: .1 },
    { offset: .4, duration: .65, frequency: 1397, waveform: 'sine', volume: .035 },
  ] },
  { id: 'buzzer', label: 'Buzzer', interval: 1, tones: [
    { offset: 0, duration: .22, frequency: 220, waveform: 'sawtooth', volume: .045 },
    { offset: .3, duration: .22, frequency: 277, waveform: 'sawtooth', volume: .045 },
  ] },
  { id: 'soft-chime', label: 'Soft chime', interval: 1.5, tones: [
    { offset: 0, duration: .6, frequency: 523, waveform: 'sine', volume: .07 },
    { offset: .25, duration: .65, frequency: 659, waveform: 'sine', volume: .07 },
    { offset: .5, duration: .8, frequency: 784, waveform: 'sine', volume: .07 },
  ] },
]
