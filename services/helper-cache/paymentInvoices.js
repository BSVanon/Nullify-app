// HD-Based Payment Invoice Bot for Nullify Helper Cache
// This subsystem lets the server act as a simple HD wallet for fee collection.
// It derives a fresh address for each invoice from a dedicated HD root key,
// stores invoice metadata, and periodically checks explorers for incoming
// funds. This is intentionally minimal and independent of BRC-29.

const fs = require('fs').promises;
const path = require('path');

let HD = null;
try {
  // Optional: only used for payment invoice generation
  ({ HD } = require('@bsv/sdk'));
} catch (err) {
  console.warn('[helper-cache] @bsv/sdk not available - payment invoice features disabled');
}

const hasFetch = typeof fetch === 'function';
if (!hasFetch) {
  console.warn('[helper-cache] Global fetch API not available - payment invoice auto-checking disabled (requires Node 18+)');
}

async function initPaymentInvoices({ app, dataDir }) {
  if (!HD) return; // Already logged in module init

  const PAYMENT_KEY_FILE = path.join(dataDir, 'payment-key.json');
  const INVOICE_FILE = path.join(dataDir, 'payment-invoices.json');

  const PAYMENT_NETWORK = (process.env.PAYMENT_NETWORK || 'main').toLowerCase();
  const PAYMENT_NET_PATH = PAYMENT_NETWORK === 'mainnet' || PAYMENT_NETWORK === 'main' ? 'main' : 'test';
  const PAYMENT_EXPLORER_PRIMARY = process.env.PAYMENT_EXPLORER_PRIMARY || 'https://api.whatsonchain.com';
  const PAYMENT_EXPLORER_FALLBACK = process.env.PAYMENT_EXPLORER_FALLBACK || 'https://api.gorillapool.io';
  const PAYMENT_POLL_INTERVAL_MS = parseInt(process.env.PAYMENT_POLL_INTERVAL_MS || '60000', 10);

  const invoices = new Map(); // id -> invoice
  const invoiceByAddress = new Map(); // address -> id
  let paymentRootKey = null;
  let nextInvoiceIndex = 0;

  async function initPaymentKey() {
    let xprv = process.env.PAYMENT_XPRV || null;

    if (!xprv) {
      // Try to load from disk
      try {
        const raw = await fs.readFile(PAYMENT_KEY_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (data && typeof data.xprv === 'string') {
          xprv = data.xprv;
        }
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.warn('[helper-cache] Failed to read payment key file:', err.message);
        }
      }
    }

    if (!xprv) {
      // Generate a new HD root key and persist it
      const key = HD.fromRandom();
      xprv = key.toString();
      const xpub = key.toPublic().toString();

      const record = {
        xprv,
        xpub,
        network: PAYMENT_NET_PATH,
        createdAt: new Date().toISOString()
      };

      try {
        await fs.writeFile(PAYMENT_KEY_FILE, JSON.stringify(record, null, 2), 'utf8');
        console.log('[helper-cache] Generated new payment HD key');
        console.log('[helper-cache]   XPUB:', xpub);
        console.log('[helper-cache]   NOTE: Backup payment-key.json from the data directory securely.');
      } catch (err) {
        console.error('[helper-cache] Failed to write payment key file:', err.message);
      }

      paymentRootKey = key;
      return;
    }

    try {
      const key = HD.fromString(xprv);
      paymentRootKey = key;
      const xpub = key.toPublic().toString();
      console.log('[helper-cache] Loaded payment HD key');
      console.log('[helper-cache]   XPUB:', xpub);
    } catch (err) {
      console.error('[helper-cache] Invalid PAYMENT_XPRV or payment-key.json:', err.message);
    }
  }

  function deriveAddressForIndex(index) {
    if (!paymentRootKey) {
      throw new Error('Payment root key not initialized');
    }
    const child = paymentRootKey.derive(`m/0/${index}`);
    const xpub = child.toPublic();
    const address = String(xpub.pubKey.toAddress());
    return { address, path: `m/0/${index}` };
  }

  async function loadInvoices() {
    try {
      const raw = await fs.readFile(INVOICE_FILE, 'utf8');
      const data = JSON.parse(raw);
      nextInvoiceIndex = typeof data.nextIndex === 'number' ? data.nextIndex : 0;
      invoices.clear();
      invoiceByAddress.clear();

      for (const inv of data.invoices || []) {
        invoices.set(inv.id, inv);
        if (inv.address) {
          invoiceByAddress.set(inv.address, inv.id);
        }
      }

      console.log(`[helper-cache] Loaded ${invoices.size} payment invoices (nextIndex=${nextInvoiceIndex})`);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log('[helper-cache] No existing payment invoices file - starting fresh');
        nextInvoiceIndex = 0;
        invoices.clear();
        invoiceByAddress.clear();
        return;
      }
      console.warn('[helper-cache] Failed to load payment invoices:', err.message);
    }
  }

  async function saveInvoices() {
    const all = Array.from(invoices.values());
    const data = {
      nextIndex: nextInvoiceIndex,
      invoices: all
    };
    try {
      await fs.writeFile(INVOICE_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.warn('[helper-cache] Failed to save payment invoices:', err.message);
    }
  }

  async function findPaymentForInvoice(invoice) {
    if (!hasFetch) return null;
    const address = invoice.address;

    // Try primary explorer (WhatsOnChain)
    try {
      const url = `${PAYMENT_EXPLORER_PRIMARY}/v1/bsv/${PAYMENT_NET_PATH}/address/${encodeURIComponent(address)}/unspent`;
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error(`WOC HTTP ${res.status}`);
      const utxos = await res.json();
      let total = 0;
      const txids = new Set();
      for (const u of utxos || []) {
        const v = u.value || u.satoshis || 0;
        total += v;
        if (u.tx_hash || u.txid) {
          txids.add(u.tx_hash || u.txid);
        }
      }
      return { total, txids: Array.from(txids) };
    } catch (_e) {
      // Fallback to GorillaPool
      try {
        const base = PAYMENT_EXPLORER_FALLBACK.includes('gorillapool.io')
          ? PAYMENT_EXPLORER_FALLBACK
          : 'https://api.gorillapool.io';
        const url = `${base}/api/bsv/${PAYMENT_NET_PATH}/address/${encodeURIComponent(address)}/utxo`;
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) throw new Error(`Gorilla HTTP ${res.status}`);
        const utxos = await res.json();
        let total = 0;
        const txids = new Set();
        for (const u of utxos || []) {
          const v = u.satoshis || u.value || 0;
          total += v;
          if (u.txid) {
            txids.add(u.txid);
          }
        }
        return { total, txids: Array.from(txids) };
      } catch (err) {
        console.warn('[helper-cache] Invoice payment check failed for', address, err.message);
        return null;
      }
    }
  }

  async function refreshInvoicePayment(invoice) {
    if (!hasFetch) return;
    const result = await findPaymentForInvoice(invoice);
    if (!result) return;

    const required = Number.isInteger(invoice.amountSatoshis) && invoice.amountSatoshis > 0
      ? invoice.amountSatoshis
      : 1;

    if (result.total >= required) {
      invoice.paid = true;
      invoice.paidAt = Date.now();
      invoice.paidAmount = result.total;
      invoice.txids = result.txids;
      console.log(`[helper-cache] Invoice ${invoice.id} paid: ${result.total} sats (required ${required})`);
    }
  }

  async function pollInvoicesOnce() {
    if (!paymentRootKey || !hasFetch) return;
    const pending = Array.from(invoices.values()).filter(inv => !inv.paid);
    if (pending.length === 0) return;

    console.log(`[helper-cache] Checking ${pending.length} pending payment invoice(s)`);
    for (const inv of pending) {
      // Best-effort; errors are logged inside helpers
      // eslint-disable-next-line no-await-in-loop
      await refreshInvoicePayment(inv);
    }
    await saveInvoices();
  }

  // Create a new payment invoice (fresh address)
  app.post('/invoices', async (req, res) => {
    try {
      if (!HD || !paymentRootKey) {
        return res.status(503).json({ error: 'Payment invoices are not configured on this server' });
      }

      const { amountSatoshis, memo, metadata } = req.body || {};

      if (amountSatoshis != null && (!Number.isInteger(amountSatoshis) || amountSatoshis <= 0)) {
        return res.status(400).json({ error: 'amountSatoshis must be a positive integer when provided' });
      }

      const index = nextInvoiceIndex++;
      const { address, path: derivationPath } = deriveAddressForIndex(index);
      const id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const now = Date.now();

      const invoice = {
        id,
        address,
        derivationPath,
        amountSatoshis: amountSatoshis != null ? amountSatoshis : null,
        memo: memo || null,
        metadata: metadata || null,
        createdAt: now,
        paid: false,
        paidAt: null,
        paidAmount: 0,
        txids: []
      };

      invoices.set(id, invoice);
      invoiceByAddress.set(address, id);
      await saveInvoices();

      console.log(`[helper-cache] Created payment invoice ${id} -> ${address} (amount: ${amountSatoshis || 'any'})`);

      return res.status(201).json({
        id,
        address,
        amountSatoshis: invoice.amountSatoshis,
        memo: invoice.memo,
        createdAt: new Date(invoice.createdAt).toISOString()
      });
    } catch (err) {
      console.error('[helper-cache] Create invoice error:', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  // Get invoice status (optionally triggering a fresh check)
  app.get('/invoices/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = invoices.get(id);

      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      if (!invoice.paid && paymentRootKey && hasFetch) {
        await refreshInvoicePayment(invoice);
        await saveInvoices();
      }

      return res.json({
        id: invoice.id,
        address: invoice.address,
        amountSatoshis: invoice.amountSatoshis,
        memo: invoice.memo,
        createdAt: new Date(invoice.createdAt).toISOString(),
        paid: !!invoice.paid,
        paidAt: invoice.paidAt ? new Date(invoice.paidAt).toISOString() : null,
        paidAmount: invoice.paidAmount || 0,
        txids: invoice.txids || []
      });
    } catch (err) {
      console.error('[helper-cache] Get invoice error:', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  // Perform initial setup and start polling
  await initPaymentKey();
  if (!paymentRootKey) {
    console.warn('[helper-cache] Payment invoices disabled - no valid HD root key');
    return;
  }

  await loadInvoices();

  if (hasFetch) {
    console.log(`[helper-cache] Starting payment invoice polling every ${Math.floor(PAYMENT_POLL_INTERVAL_MS / 1000)}s`);
    await pollInvoicesOnce();
    setInterval(pollInvoicesOnce, PAYMENT_POLL_INTERVAL_MS);
  } else {
    console.warn('[helper-cache] Payment invoices will not be auto-checked - fetch API not available');
  }
}

module.exports = { initPaymentInvoices };
