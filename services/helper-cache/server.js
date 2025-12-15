#!/usr/bin/env node
/**
 * Nullify Helper Cache Server
 * Temporary encrypted message storage for offline delivery
 * Port: 4100
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

// Payment invoice infrastructure removed - donations now go directly to merchant wallet
// const { initPaymentInvoices } = require('./paymentInvoices');

const app = express();
const PORT = process.env.PORT || 4100;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const TTL_SECONDS = parseInt(process.env.TTL_SECONDS || '172800', 10); // 48 hours default
const MAX_ENTRIES = parseInt(process.env.MAX_ENTRIES || '10000', 10);
const MAX_BYTES = parseInt(process.env.MAX_BYTES || '524288000', 10); // 500 MB default

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// In-memory index for fast lookups
const cacheIndex = new Map();
let serverStartTime = Date.now();

// Initialize data directory
async function initDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log(`[helper-cache] Data directory: ${DATA_DIR}`);

    // Load existing cache entries (skip non-cache JSON files)
    const files = await fs.readdir(DATA_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      if (file === 'payment-key.json' || file === 'payment-invoices.json') continue;
      try {
        const filePath = path.join(DATA_DIR, file);
        const content = await fs.readFile(filePath, 'utf8');
        const entry = JSON.parse(content);
        cacheIndex.set(entry.id, {
          id: entry.id,
          size: Buffer.byteLength(JSON.stringify(entry.payload)),
          createdAt: entry.createdAt,
          expiresAt: entry.expiresAt
        });
      } catch (err) {
        console.warn(`[helper-cache] Failed to load ${file}:`, err.message);
      }
    }
    console.log(`[helper-cache] Loaded ${cacheIndex.size} existing entries`);
  } catch (err) {
    console.error('[helper-cache] Failed to initialize data directory:', err);
    process.exit(1);
  }
}


// Calculate current usage
function getUsage() {
  let totalBytes = 0;
  let oldestEntry = null;
  let newestEntry = null;
  
  for (const entry of cacheIndex.values()) {
    totalBytes += entry.size;
    if (!oldestEntry || entry.createdAt < oldestEntry) {
      oldestEntry = entry.createdAt;
    }
    if (!newestEntry || entry.createdAt > newestEntry) {
      newestEntry = entry.createdAt;
    }
  }
  
  return {
    entryCount: cacheIndex.size,
    totalBytes,
    oldestEntry,
    newestEntry
  };
}

// Prune expired entries
async function pruneExpired() {
  const now = Date.now();
  const expired = [];
  
  for (const [id, entry] of cacheIndex.entries()) {
    if (entry.expiresAt && entry.expiresAt < now) {
      expired.push(id);
    }
  }
  
  let pruned = 0;
  for (const id of expired) {
    try {
      const filePath = path.join(DATA_DIR, `${id}.json`);
      await fs.unlink(filePath);
      cacheIndex.delete(id);
      pruned++;
    } catch (err) {
      console.warn(`[helper-cache] Failed to prune ${id}:`, err.message);
    }
  }
  
  return pruned;
}

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'nullify-helper-cache',
    uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    entries: cacheIndex.size
  });
});

// Status endpoint
app.get('/status', (req, res) => {
  const usage = getUsage();
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    entries: cacheIndex.size,
    totalBytes: usage.totalBytes,
    updatedAt: new Date().toISOString()
  });
});

// Quota endpoint
app.get('/quota', (req, res) => {
  const usage = getUsage();
  res.json({
    limitBytes: MAX_BYTES,
    usedBytes: usage.totalBytes,
    ttlSeconds: TTL_SECONDS,
    entryLimit: MAX_ENTRIES,
    entryCount: cacheIndex.size,
    oldestEntryIso: usage.oldestEntry ? new Date(usage.oldestEntry).toISOString() : null,
    newestEntryIso: usage.newestEntry ? new Date(usage.newestEntry).toISOString() : null
  });
});

// Store encrypted message
app.post('/cache', async (req, res) => {
  try {
    const { id, payload } = req.body;
    
    if (!id || !payload) {
      return res.status(400).json({ error: 'Missing id or payload' });
    }
    
    // Check limits
    const usage = getUsage();
    const payloadSize = Buffer.byteLength(JSON.stringify(payload));
    
    if (cacheIndex.size >= MAX_ENTRIES) {
      return res.status(507).json({ error: 'Entry limit exceeded' });
    }
    
    if (usage.totalBytes + payloadSize > MAX_BYTES) {
      return res.status(507).json({ error: 'Storage limit exceeded' });
    }
    
    const now = Date.now();
    const isWalletBackup = typeof id === 'string' && id.startsWith('wallet-backup:');
    const expiresAt = isWalletBackup ? null : now + (TTL_SECONDS * 1000);
    const entry = {
      id,
      payload,
      createdAt: now,
      expiresAt
    };
    
    // Write to disk
    const filePath = path.join(DATA_DIR, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf8');
    
    // Update index
    cacheIndex.set(id, {
      id,
      size: payloadSize,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt
    });
    
    const expiresLabel = entry.expiresAt ? new Date(entry.expiresAt).toISOString() : 'never';
    console.log(`[helper-cache] Stored ${id} (${payloadSize} bytes, expires ${expiresLabel})`);
    
    res.status(201).json({
      stored: true,
      id,
      expiresAt: entry.expiresAt ? new Date(entry.expiresAt).toISOString() : null
    });
  } catch (err) {
    console.error('[helper-cache] Store error:', err);
    res.status(500).json({ error: 'Failed to store entry' });
  }
});

// Fetch encrypted message
app.get('/cache/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!cacheIndex.has(id)) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    const indexEntry = cacheIndex.get(id);
    
    // Check if expired
    if (indexEntry.expiresAt && indexEntry.expiresAt < Date.now()) {
      // Delete expired entry
      const filePath = path.join(DATA_DIR, `${id}.json`);
      await fs.unlink(filePath).catch(() => {});
      cacheIndex.delete(id);
      return res.status(404).json({ error: 'Entry expired' });
    }
    
    // Read from disk
    const filePath = path.join(DATA_DIR, `${id}.json`);
    const content = await fs.readFile(filePath, 'utf8');
    const entry = JSON.parse(content);
    
    console.log(`[helper-cache] Fetched ${id}`);
    
    res.json(entry.payload);
  } catch (err) {
    console.error('[helper-cache] Fetch error:', err);
    if (err.code === 'ENOENT') {
      cacheIndex.delete(req.params.id);
      return res.status(404).json({ error: 'Entry not found' });
    }
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

// Delete encrypted message (after delivery)
app.delete('/cache/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!cacheIndex.has(id)) {
      return res.status(404).json({ deleted: false, error: 'Entry not found' });
    }
    
    const filePath = path.join(DATA_DIR, `${id}.json`);
    await fs.unlink(filePath);
    cacheIndex.delete(id);
    
    console.log(`[helper-cache] Deleted ${id}`);
    
    res.json({ deleted: true, id });
  } catch (err) {
    console.error('[helper-cache] Delete error:', err);
    if (err.code === 'ENOENT') {
      cacheIndex.delete(req.params.id);
      return res.json({ deleted: false, error: 'Entry not found' });
    }
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

// Paymail proxy - resolves paymail addresses to payment destinations (avoids CORS)
app.post('/paymail/resolve', async (req, res) => {
  try {
    const { paymail, satoshis } = req.body;
    if (!paymail || typeof paymail !== 'string' || !paymail.includes('@')) {
      return res.status(400).json({ error: 'Invalid paymail address' });
    }
    if (!satoshis || typeof satoshis !== 'number' || satoshis <= 0) {
      return res.status(400).json({ error: 'Invalid satoshis amount' });
    }

    const [alias, domain] = paymail.split('@');
    console.log(`[helper-cache] Resolving paymail: ${paymail} for ${satoshis} sats`);

    // Step 1: Fetch .well-known/bsvalias
    const wellKnownUrl = `https://${domain}/.well-known/bsvalias`;
    const wellKnownRes = await fetch(wellKnownUrl);
    if (!wellKnownRes.ok) {
      return res.status(502).json({ error: `Failed to fetch paymail capabilities from ${domain}` });
    }
    const capabilities = await wellKnownRes.json();

    // Step 2: Find P2P Payment Destination capability
    const p2pDestTemplate = capabilities.capabilities?.['2a40af698840'];
    if (!p2pDestTemplate) {
      return res.status(502).json({ error: `Paymail provider ${domain} does not support P2P Payment Destinations` });
    }

    // Step 3: Request payment destination
    const p2pDestUrl = p2pDestTemplate
      .replace('{alias}', alias)
      .replace('{domain.tld}', domain);

    const destRes = await fetch(p2pDestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ satoshis }),
    });

    if (!destRes.ok) {
      const errText = await destRes.text().catch(() => '');
      return res.status(502).json({ error: `Failed to get payment destination: ${destRes.status} ${errText}` });
    }

    const destination = await destRes.json();
    console.log(`[helper-cache] Paymail resolved: ${paymail} -> ${destination.outputs?.length || 0} outputs`);

    res.json(destination);
  } catch (err) {
    console.error('[helper-cache] Paymail resolve error:', err);
    res.status(500).json({ error: 'Failed to resolve paymail' });
  }
});

// Prune expired entries
app.post('/cache/prune', async (req, res) => {
  try {
    const pruned = await pruneExpired();
    console.log(`[helper-cache] Pruned ${pruned} expired entries`);
    res.json({ pruned, remaining: cacheIndex.size });
  } catch (err) {
    console.error('[helper-cache] Prune error:', err);
    res.status(500).json({ error: 'Failed to prune entries' });
  }
});

// Start server
async function start() {
  await initDataDir();
  // Payment invoice infrastructure removed - donations now go directly to merchant wallet
  // await initPaymentInvoices({ app, dataDir: DATA_DIR });

  // Auto-prune every hour
  setInterval(async () => {
    const pruned = await pruneExpired();
    if (pruned > 0) {
      console.log(`[helper-cache] Auto-pruned ${pruned} expired entries`);
    }
  }, 3600000); // 1 hour
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[helper-cache] Nullify Helper Cache Server listening on port ${PORT}`);
    console.log(`[helper-cache] TTL: ${TTL_SECONDS}s (${Math.floor(TTL_SECONDS / 3600)}h)`);
    console.log(`[helper-cache] Max entries: ${MAX_ENTRIES}`);
    console.log(`[helper-cache] Max storage: ${Math.floor(MAX_BYTES / 1024 / 1024)}MB`);
  });
}

start().catch(err => {
  console.error('[helper-cache] Fatal error:', err);
  process.exit(1);
});
