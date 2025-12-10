import { getWallet } from './client.js';

export function uint8ToBase64(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new Error('uint8ToBase64 expects Uint8Array');
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToUint8(base64) {
  if (!base64 || typeof base64 !== 'string') throw new Error('base64 string required');
  // Use browser-compatible atob
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function wrapEncryptionKey(rawKeyBytes, { recipientPubKey } = {}) {
  if (!(rawKeyBytes instanceof Uint8Array)) {
    throw new Error('rawKeyBytes must be a Uint8Array');
  }

  try {
    const { client } = await getWallet();
    if (!client) {
      throw new Error('No wallet connected');
    }

    const { wrapKeyWithWallet, wrapKeyWithECIES } = await import('../crypto/keyWrapping.js');

    let wrappedKey;
    if (recipientPubKey) {
      wrappedKey = await wrapKeyWithECIES(rawKeyBytes, recipientPubKey);
    } else {
      wrappedKey = await wrapKeyWithWallet(rawKeyBytes, client);
    }

    return { wrappedKey };
  } catch (err) {
    console.error('wrapEncryptionKey: Failed to wrap key', err);
    throw new Error(`Key wrapping failed: ${err.message}`);
  }
}
