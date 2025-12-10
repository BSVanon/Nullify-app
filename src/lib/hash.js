// Web Crypto SHA-256 hashing utilities for browser
// Returns hex strings for buffers and files

export async function sha256ArrayBuffer(buf) {
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(hashBuf);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashFile(file) {
  if (!(file instanceof Blob)) throw new Error('hashFile: expected a File/Blob');
  const buf = await file.arrayBuffer();
  return sha256ArrayBuffer(buf);
}

export async function sha256StringUtf8(str) {
  const enc = new TextEncoder();
  return sha256ArrayBuffer(enc.encode(str));
}
