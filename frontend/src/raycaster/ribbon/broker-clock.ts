export const brokerClock = (at: number) => new Date(at).toISOString().slice(0, 19).replace('T', ' ') + ' · broker time'
