import { appStateStore } from './storage'

const CAPS_KEY = 'wallet-spend-caps'

export const DEFAULT_SATS_PER_MESSAGE = 25
export const DEFAULT_DAILY_SATS = 1000

export async function getSpendCaps() {
  try {
    const stored = await appStateStore.getItem(CAPS_KEY)
    if (!stored || typeof stored !== 'object') {
      return {
        satsPerMessage: DEFAULT_SATS_PER_MESSAGE,
        dailyCapSats: DEFAULT_DAILY_SATS,
      }
    }

    const satsPerMessage = Number.parseInt(stored.satsPerMessage ?? DEFAULT_SATS_PER_MESSAGE, 10)
    const dailyCapSats = Number.parseInt(stored.dailyCapSats ?? DEFAULT_DAILY_SATS, 10)

    return {
      satsPerMessage: Number.isFinite(satsPerMessage) && satsPerMessage >= 0 ? satsPerMessage : DEFAULT_SATS_PER_MESSAGE,
      dailyCapSats: Number.isFinite(dailyCapSats) && dailyCapSats >= 0 ? dailyCapSats : DEFAULT_DAILY_SATS,
    }
  } catch (error) {
    console.warn('[spendCaps] failed to read caps, using defaults', error)
    return {
      satsPerMessage: DEFAULT_SATS_PER_MESSAGE,
      dailyCapSats: DEFAULT_DAILY_SATS,
    }
  }
}

export async function setSpendCaps({ satsPerMessage, dailyCapSats }) {
  const next = {
    satsPerMessage: Number.isFinite(satsPerMessage) && satsPerMessage >= 0 ? Math.floor(satsPerMessage) : DEFAULT_SATS_PER_MESSAGE,
    dailyCapSats: Number.isFinite(dailyCapSats) && dailyCapSats >= 0 ? Math.floor(dailyCapSats) : DEFAULT_DAILY_SATS,
  }

  try {
    await appStateStore.setItem(CAPS_KEY, next)
    return next
  } catch (error) {
    console.warn('[spendCaps] failed to persist caps', error)
    throw error
  }
}
