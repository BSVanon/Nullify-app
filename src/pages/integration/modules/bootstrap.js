import { createRpcProxy } from '/src/lib/wallet/rpcProxy.js'
import { createBrc6Proxy } from '/src/lib/wallet/brc6Proxy.js'

export function initBootstrap({ origin, iframe, isEmbedded }) {
  const modeLabel = document.getElementById('mode-label')
  if (modeLabel) {
    modeLabel.textContent = isEmbedded ? 'Mode: Embedded (BRC-6)' : 'Mode: Standalone (BRC-7)'
  }
  if (isEmbedded && iframe) {
    iframe.style.display = 'none'
  }

  const resultEl = document.getElementById('result')

  function renderStatus(message, variant = 'neutral') {
    if (!resultEl) return
    resultEl.innerHTML = message
    const styles = {
      success: { background: '#dcfce7', color: '#166534' },
      warning: { background: '#fef9c3', color: '#854d0e' },
      error: { background: '#fef2f2', color: '#ef4444' },
      neutral: { background: '#f3f4f6', color: '#1f2937' }
    }
    const applied = styles[variant] || styles.neutral
    resultEl.style.background = applied.background
    resultEl.style.color = applied.color
  }

  let rpc = null
  function ensureRpc() {
    if (rpc) return rpc
    if (isEmbedded) {
      rpc = createBrc6Proxy(window.parent, origin)
    } else {
      if (!iframe || !iframe.contentWindow) {
        throw new Error('Wallet iframe not available')
      }
      rpc = createRpcProxy(iframe.contentWindow, origin)
    }
    return rpc
  }

  function requestCWI(reason = 'manual') {
    if (!iframe || !iframe.contentWindow) {
      renderStatus('<h3>❌ Wallet iframe not available</h3>', 'error')
      return
    }
    renderStatus(`<p>Requesting CWI from wallet (${reason})...</p>`, 'warning')
    iframe.contentWindow.postMessage({ type: 'REQUEST_CWI' }, origin)
  }

  window.testIntegration = async function testIntegration() {
    if (isEmbedded) {
      try {
        const version = await ensureRpc().getVersion()
        renderStatus(`<h3>✅ SUCCESS: BRC-6 Wallet Detected!</h3><pre>${JSON.stringify(version, null, 2)}</pre>`, 'success')
      } catch (err) {
        renderStatus(`<h3>❌ BRC-6 RPC failed</h3><pre>${err.message}</pre>`, 'error')
      }
      return
    }

    if (window.CWI) {
      renderStatus('<h3>✅ SUCCESS: BRC-7 Wallet Detected!</h3><p>Wallet is available in this context.</p>', 'success')
      return
    }
    requestCWI('button')
  }

  window.addEventListener('message', (event) => {
    if (event.origin !== origin) return
    const data = event.data || {}

    if (data.type === 'BRC7_WALLET_READY') {
      renderStatus('<h3>✅ Wallet Ready</h3><p>Iframe reports ready. Requesting CWI…</p>', 'success')
      try {
        if (iframe && iframe.contentWindow && iframe.contentWindow.CWI && typeof iframe.contentWindow.CWI.getVersion === 'function') {
          window.CWI = iframe.contentWindow.CWI
          renderStatus('<h3>✅ CWI Ready</h3><p>Bound immediately from iframe.</p>', 'success')
        } else {
          requestCWI('message')
        }
      } catch (err) {
        console.debug('Unable to postMessage REQUEST_CWI from message handler', err)
      }
      return
    }

    if (data.type === 'CWI_READY') {
      if (iframe && iframe.contentWindow && iframe.contentWindow.CWI) {
        window.CWI = iframe.contentWindow.CWI
        renderStatus('<h3>✅ CWI Ready</h3><p>Parent now has access via window.CWI (proxied to iframe).</p>', 'success')
      } else {
        renderStatus('<h3>⚠️ CWI Ready (pending)</h3><p>Waiting for iframe to expose CWI...</p>', 'warning')
        let attempts = 0
        const timer = setInterval(() => {
          attempts += 1
          if (iframe && iframe.contentWindow && iframe.contentWindow.CWI) {
            clearInterval(timer)
            window.CWI = iframe.contentWindow.CWI
            renderStatus('<h3>✅ CWI Ready</h3><p>Parent now has access via window.CWI (proxied to iframe).</p>', 'success')
          } else if (attempts > 20) {
            clearInterval(timer)
            renderStatus('<h3>❌ CWI not exposed</h3><p>Iframe did not expose CWI in time.</p>', 'error')
          }
        }, 150)
      }
    }
  })

  if (iframe) {
    iframe.addEventListener('load', () => {
      renderStatus('<p>Wallet iframe loaded. Requesting CWI...</p>', 'warning')
      requestCWI('iframe-load')
    })
  }

  window.parentGetVersion = async function parentGetVersion() {
    try {
      if (isEmbedded) {
        const res = await ensureRpc().getVersion()
        renderStatus(`<pre>embedded.getVersion -> ${JSON.stringify(res, null, 2)}</pre>`, 'success')
      } else {
        if (!window.CWI) {
          renderStatus('<p>Parent: CWI not ready</p>', 'warning')
          return
        }
        const res = await window.CWI.getVersion()
        renderStatus(`<pre>parent.getVersion -> ${JSON.stringify(res, null, 2)}</pre>`, 'success')
      }
    } catch (err) {
      renderStatus(`<pre>getVersion error -> ${err.message}</pre>`, 'error')
    }
  }

  window.parentGetNetwork = async function parentGetNetwork() {
    try {
      if (isEmbedded) {
        const res = await ensureRpc().getNetwork()
        renderStatus(`<pre>embedded.getNetwork -> ${JSON.stringify(res, null, 2)}</pre>`, 'success')
      } else {
        if (!window.CWI) {
          renderStatus('<p>Parent: CWI not ready</p>', 'warning')
          return
        }
        const res = await window.CWI.getNetwork()
        renderStatus(`<pre>parent.getNetwork -> ${JSON.stringify(res, null, 2)}</pre>`, 'success')
      }
    } catch (err) {
      renderStatus(`<pre>getNetwork error -> ${err.message}</pre>`, 'error')
    }
  }

  async function retryRpcCall(fn, maxAttempts = 5, delayMs = 150, label = 'rpc') {
    let lastErr
    for (let i = 0; i < maxAttempts; i += 1) {
      try {
        try {
          iframe?.contentWindow?.postMessage?.({ type: 'REQUEST_CWI' }, origin)
        } catch (postErr) {
          console.debug('Unable to postMessage REQUEST_CWI during retry', postErr)
        }
        return await fn()
      } catch (err) {
        lastErr = err
        const msg = String(err?.message || err)
        if (!/timeout|not ready|unavailable/i.test(msg)) break
        await new Promise((res) => setTimeout(res, delayMs))
      }
    }
    throw lastErr || new Error(`${label} failed`)
  }

  renderStatus('<p>Status: Initializing...</p>')

  return {
    ensureRpc,
    retryRpcCall,
    renderStatus,
    requestCWI,
    origin,
    iframe,
    isEmbedded
  }
}
