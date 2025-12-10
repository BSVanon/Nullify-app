import walletBootstrap from '/src/lib/walletBootstrap.js'

export function initJsonApiDiagnostics(renderStatus) {
  async function checkJsonApiStatus() {
    try {
      const status = await walletBootstrap.initialize('json-api')
      const summary = {
        walletType: status.walletType,
        identityKey: status.identityKey,
        network: status.network || 'unknown',
        version: status.version || 'unknown'
      }
      renderStatus(`<h3>✅ JSON-API Wallet Connected</h3><pre>${JSON.stringify(summary, null, 2)}</pre>`, 'success')
    } catch (error) {
      renderStatus(
        `<h3>⚠️ JSON-API wallet unavailable</h3><p>${error?.message || error || 'Unknown error'}</p><p>Ensure Metanet Desktop is running on ${(window.location.hostname || 'localhost')}:3301 and try again.</p>`,
        'warning'
      )
    }
  }

  window.checkJsonApiStatus = checkJsonApiStatus
  return { checkJsonApiStatus }
}
