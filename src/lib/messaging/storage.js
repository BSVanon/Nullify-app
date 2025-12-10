import localforage from 'localforage'

const BASE_CONFIG = {
  name: 'nukenote-messaging'
}

export const appStateStore = localforage.createInstance({
  ...BASE_CONFIG,
  storeName: 'app-state'
})

export const joinReceiptStore = localforage.createInstance({
  ...BASE_CONFIG,
  storeName: 'join-receipts'
})

export const guestIdentityStore = localforage.createInstance({
  ...BASE_CONFIG,
  storeName: 'guest-identities'
})

export const vaultStore = localforage.createInstance({
  ...BASE_CONFIG,
  storeName: 'vault'
})

export const blockedInviterStore = localforage.createInstance({
  ...BASE_CONFIG,
  storeName: 'blocked-inviters'
})

export const threadMetadataStore = localforage.createInstance({
  ...BASE_CONFIG,
  storeName: 'thread-metadata'
})

export const overlayTelemetryStore = localforage.createInstance({
  ...BASE_CONFIG,
  storeName: 'overlay-telemetry'
})

// Re-export functions from modules
export * from './remoteSyncHelpers'
export * from './payloadBuilders'
export * from './joinReceipts'
export * from './threadMetadata'
export * from './telemetry'
export * from './guestIdentities'
export * from './vault'
export * from './blockedInviters'
export * from './appState'
