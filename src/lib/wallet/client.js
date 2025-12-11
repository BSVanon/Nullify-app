import { CONFIG } from '../config.js';
import walletBootstrap from '../walletBootstrap.js';

// Track if we've done a warmup probe for this session
let walletWarmedUp = false;

// Debug logging helper - warmup logs always visible for diagnostics
const debugLog = (...args) => {
  console.log(...args);
};

/**
 * Warm up the wallet by syncing UTXO cache.
 * 
 * NOTE: Basic connectivity is already verified during bootstrap via BRC-73 
 * waitForAuthentication + getPublicKey. This warmup only refreshes UTXO cache.
 * 
 * The key insight: Metanet Desktop caches UTXOs locally. If the wallet was used
 * elsewhere or UTXOs were spent, the cache can be stale. Calling listActions
 * forces the wallet to sync its UTXO set with the blockchain.
 */
async function warmupWallet(wallet) {
  if (walletWarmedUp) return;
  
  const start = Date.now();
  
  try {
    // Skip getPublicKey probe - already done during bootstrap with BRC-73 grouped permissions
    // Only refresh UTXO cache to prevent stale spending errors
    if (typeof wallet.listActions === 'function') {
      debugLog('[getWallet] Refreshing wallet UTXO cache via listActions...');
      try {
        await wallet.listActions({ limit: 1 });
        debugLog('[getWallet] UTXO cache refresh complete in', Date.now() - start, 'ms');
      } catch (listErr) {
        // listActions may fail on some wallets or if there are no actions yet - that's OK
        debugLog('[getWallet] listActions warmup skipped:', listErr.message);
      }
    }
    
    walletWarmedUp = true;
    debugLog('[getWallet] Wallet warmup complete in', Date.now() - start, 'ms');
  } catch (err) {
    console.warn('[getWallet] Wallet warmup failed:', err.message);
    // Don't throw - let the actual operation fail with a better error
  }
}

export async function getWallet({ autoConnect = true } = {}) {
  const status = walletBootstrap.getStatus();
  if (status.isConnected && status.wallet) {
    debugLog('[getWallet] Returning connected wallet:', { 
      type: status.walletType, 
      clientType: status.wallet?.constructor?.name,
      substrate: status.wallet?.substrate
    });
    
    // Ensure wallet is warmed up before returning
    await warmupWallet(status.wallet);
    
    return { type: status.walletType, client: status.wallet };
  }

  if (!autoConnect) {
    throw new Error('Wallet is not connected. Please connect via the wallet panel.');
  }

  try {
    const result = await walletBootstrap.initialize(CONFIG.WALLET_SUBSTRATE || 'auto');
    debugLog('[getWallet] Initialized wallet:', { 
      type: result.walletType, 
      clientType: result.wallet?.constructor?.name,
      substrate: result.wallet?.substrate
    });
    
    // Warmup the newly initialized wallet
    await warmupWallet(result.wallet);
    
    return { type: result.walletType, client: result.wallet };
  } catch (err) {
    const message = err?.message || 'Unknown wallet initialization error';
    throw new Error(`Unable to connect to wallet: ${message}`);
  }
}

/**
 * Reset wallet warmup state (call on disconnect)
 */
export function resetWalletWarmup() {
  walletWarmedUp = false;
}

/**
 * Force a UTXO cache refresh. Call this before operations that need to spend
 * recently-created UTXOs (like burning a just-minted CT).
 * 
 * This is separate from the one-time warmup because some operations need
 * a fresh sync even after the initial warmup has completed.
 */
export async function forceUtxoRefresh() {
  const status = walletBootstrap.getStatus();
  if (!status.isConnected || !status.wallet) {
    console.warn('[forceUtxoRefresh] Wallet not connected');
    return false;
  }
  
  const wallet = status.wallet;
  const start = Date.now();
  
  try {
    if (typeof wallet.listActions === 'function') {
      console.log('[forceUtxoRefresh] Refreshing wallet UTXO cache...');
      await wallet.listActions({ limit: 1 });
      console.log('[forceUtxoRefresh] UTXO cache refresh complete in', Date.now() - start, 'ms');
      return true;
    }
  } catch (err) {
    console.warn('[forceUtxoRefresh] Failed:', err.message);
  }
  
  return false;
}

export function extractTxid(res) {
  if (!res || typeof res !== 'object') return null;
  return (
    res.txid ||
    (res.result && res.result.txid) ||
    res.transactionId ||
    res.id ||
    null
  );
}

export async function getWalletBalance() {
  const { client } = await getWallet();
  if (typeof client.getBalance === 'function') {
    return await client.getBalance();
  }
  throw new Error('Wallet balance not supported by this substrate');
}
