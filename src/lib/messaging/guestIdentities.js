import { guestIdentityStore } from './storage'

export async function saveGuestIdentity(identityId, identity) {
  if (!identityId) throw new Error('identityId required to save guest identity')
  await guestIdentityStore.setItem(identityId, identity)
  return identity
}

export async function getGuestIdentity(identityId) {
  if (!identityId) return null
  return guestIdentityStore.getItem(identityId)
}

export async function listGuestIdentities() {
  const identities = []
  await guestIdentityStore.iterate((value) => {
    if (value) identities.push(value)
  })
  return identities
}

export async function deleteGuestIdentity(identityId) {
  if (!identityId) return
  await guestIdentityStore.removeItem(identityId)
}
