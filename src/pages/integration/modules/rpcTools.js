export function initRpcTools({ ensureRpc, retryRpcCall, renderStatus }) {
  window.rpcGetVersion = async () => {
    try {
      const result = await retryRpcCall(() => ensureRpc().getVersion(), 5, 150, 'getVersion')
      renderStatus(`<pre>rpc.getVersion -> ${JSON.stringify(result, null, 2)}</pre>`, 'success')
    } catch (err) {
      renderStatus(`<pre>rpc.getVersion error -> ${err.message}</pre>`, 'error')
    }
  }

  window.rpcGetNetwork = async () => {
    try {
      const result = await retryRpcCall(() => ensureRpc().getNetwork(), 5, 150, 'getNetwork')
      renderStatus(`<pre>rpc.getNetwork -> ${JSON.stringify(result, null, 2)}</pre>`, 'success')
    } catch (err) {
      renderStatus(`<pre>rpc.getNetwork error -> ${err.message}</pre>`, 'error')
    }
  }

  window.rpcIsAuthenticated = async () => {
    try {
      const result = await retryRpcCall(() => ensureRpc().isAuthenticated(), 5, 150, 'isAuthenticated')
      renderStatus(`<pre>rpc.isAuthenticated -> ${JSON.stringify(result, null, 2)}</pre>`, 'success')
    } catch (err) {
      renderStatus(`<pre>rpc.isAuthenticated error -> ${err.message}</pre>`, 'error')
    }
  }

  window.rpcCauseError = async () => {
    try {
      const res = await ensureRpc().createAction({ description: 'should fail' })
      renderStatus(`<pre>rpc.createAction (unexpected success) -> ${JSON.stringify(res, null, 2)}</pre>`, 'warning')
    } catch (err) {
      renderStatus(`<pre>rpc.createAction error (expected) -> ${err.message}</pre>`, 'success')
    }
  }
}
