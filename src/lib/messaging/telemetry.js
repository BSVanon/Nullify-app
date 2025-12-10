import { overlayTelemetryStore } from './storage'

const TELEMETRY_ENTRIES_KEY = 'entries'
const TELEMETRY_MAX_ENTRIES = 200

export async function appendOverlayTelemetry(event) {
  if (!event) return []
  const existing = (await overlayTelemetryStore.getItem(TELEMETRY_ENTRIES_KEY)) || []
  existing.push(event)
  const trimmed = existing.slice(-TELEMETRY_MAX_ENTRIES)
  await overlayTelemetryStore.setItem(TELEMETRY_ENTRIES_KEY, trimmed)
  return trimmed
}

export async function listOverlayTelemetry(limit = TELEMETRY_MAX_ENTRIES) {
  const existing = (await overlayTelemetryStore.getItem(TELEMETRY_ENTRIES_KEY)) || []
  if (!limit || limit <= 0) return existing
  return existing.slice(-limit)
}

export async function clearOverlayTelemetry() {
  await overlayTelemetryStore.setItem(TELEMETRY_ENTRIES_KEY, [])
}
