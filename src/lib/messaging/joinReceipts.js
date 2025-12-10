import { joinReceiptStore } from './storage'

export async function saveJoinReceipt(threadId, receipt) {
  if (!threadId) throw new Error('threadId required to save join receipt')
  await joinReceiptStore.setItem(threadId, receipt)
  return receipt
}

export async function getJoinReceipt(threadId) {
  if (!threadId) return null
  return joinReceiptStore.getItem(threadId)
}

export async function listJoinReceipts() {
  const receipts = []
  await joinReceiptStore.iterate((value) => {
    if (value) receipts.push(value)
  })
  return receipts
}

export async function updateJoinReceipt(threadId, updates) {
  if (!threadId) throw new Error('threadId required to update join receipt')
  const existing = await joinReceiptStore.getItem(threadId)
  if (!existing) return null
  const updated = { ...existing, ...updates }
  await joinReceiptStore.setItem(threadId, updated)
  return updated
}

export async function deleteJoinReceipt(threadId) {
  if (!threadId) return
  await joinReceiptStore.removeItem(threadId)
}
