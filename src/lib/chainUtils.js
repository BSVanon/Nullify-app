// src/lib/chainUtils.js
// Shared chain parsing helpers for OP_RETURN extraction/formatting

export function parseScriptHexPushes(hex) {
  if (!hex || typeof hex !== 'string') return [];
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  let i = 0;
  const pushes = [];
  function readByte() { return bytes[i++]; }
  if (readByte() !== 0x6a) return []; // not OP_RETURN (expects OP_RETURN at start)
  while (i < bytes.length) {
    let len = readByte();
    if (len === 0x4c) { // OP_PUSHDATA1
      len = readByte();
    } else if (len === 0x4d) { // OP_PUSHDATA2
      const b1 = readByte();
      const b2 = readByte();
      len = b1 | (b2 << 8);
    } else if (len === 0x4e) { // OP_PUSHDATA4
      const b1 = readByte();
      const b2 = readByte();
      const b3 = readByte();
      const b4 = readByte();
      len = b1 | (b2 << 8) | (b3 << 16) | (b4 << 24);
    } else if (len >= 0x01 && len <= 0x4b) {
      // literal length
    } else {
      // unknown opcode, stop
      break;
    }
    if (i + len > bytes.length) break;
    pushes.push(bytes.slice(i, i + len));
    i += len;
  }
  return pushes;
}

export function extractOpReturnFromTx(tx) {
  if (!tx) return [];
  const vouts = tx.vout || tx.outputs || [];
  for (const o of vouts) {
    const spk = o.scriptPubKey || {};
    let hex = spk.hex;
    if (!hex && spk.asm && spk.asm.startsWith('OP_RETURN')) {
      // asm form not reliably decodable to bytes without sizes; skip
    }
    if (!hex && o.script && typeof o.script === 'string') {
      hex = o.script;
    }
    if (!hex) continue;
    if (hex.startsWith('6a')) {
      const pushes = parseScriptHexPushes(hex);
      if (pushes.length) return pushes;
    }
  }
  return [];
}

export function toHex(buf) { return [...buf].map(b => b.toString(16).padStart(2,'0')).join(''); }
export function tryUtf8(buf) { try { return new TextDecoder().decode(buf); } catch { return null; } }

export function formatDecoded(pushes) {
  const parts = pushes.map((buf) => {
    const text = tryUtf8(buf);
    if (text && /^[\x20-\x7E]*$/.test(text)) {
      return text;
    }
    return `0x${toHex(buf)}`;
  });
  return parts;
}
