// Run this in browser console to inspect vault data
// Copy and paste into DevTools console while app is running

(async function inspectVault() {
  const localforage = (await import('localforage')).default;
  
  const vaultStore = localforage.createInstance({
    name: 'nukenote-messaging',
    storeName: 'vault'
  });

  const receiptStore = localforage.createInstance({
    name: 'nukenote-messaging',
    storeName: 'join-receipts'
  });

  console.log('\n=== VAULT MESSAGES (last 5) ===');
  const messages = [];
  await vaultStore.iterate((value, key) => {
    messages.push({ key, ...value });
  });
  
  messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  messages.slice(-5).forEach(msg => {
    console.log(`\nMessage ID: ${msg.id}`);
    console.log(`  Thread: ${msg.threadId}`);
    console.log(`  Author: "${msg.author}" (type: ${typeof msg.author})`);
    console.log(`  Text: ${msg.text?.substring(0, 30)}...`);
    console.log(`  Delivery: ${msg.delivery}`);
  });

  console.log('\n=== JOIN RECEIPTS ===');
  await receiptStore.iterate((value, key) => {
    console.log(`\nThread: ${key}`);
    console.log(`  Identity Kind: ${value.identityKind}`);
    console.log(`  Guest PubKey: ${value.guestPublicKey || 'none'}`);
    console.log(`  Holder PubKey: ${value.holderPublicKey || 'none'}`);
    console.log(`  Status: ${value.status}`);
  });
})();
