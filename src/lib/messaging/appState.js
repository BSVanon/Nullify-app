import { appStateStore } from './storage'

const APP_ONBOARDING_FLAG_KEY = 'onboarding-complete'

export async function isOnboardingComplete() {
  try {
    const value = await appStateStore.getItem(APP_ONBOARDING_FLAG_KEY)
    return Boolean(value)
  } catch (error) {
    console.warn('[storage] failed to read onboarding flag', error)
    return false
  }
}

export async function setOnboardingComplete(completed = true) {
  try {
    await appStateStore.setItem(APP_ONBOARDING_FLAG_KEY, Boolean(completed))
    return Boolean(completed)
  } catch (error) {
    console.warn('[storage] failed to persist onboarding flag', error)
    throw error
  }
}
