import { initBootstrap } from './integration/modules/bootstrap.js'
import { initUiHelpers } from './integration/modules/uiHelpers.js'
import { initJsonApiDiagnostics } from './integration/modules/jsonApi.js'
import { initRpcTools } from './integration/modules/rpcTools.js'
import { initPaymentVerification } from './integration/modules/payment.js'
import { initInvoiceTools } from './integration/modules/invoice.js'

const origin = window.location.origin
const iframe = document.getElementById('wallet-iframe')
const isEmbedded = window.top !== window.self

const bootstrap = initBootstrap({ origin, iframe, isEmbedded })
initUiHelpers()
initJsonApiDiagnostics(bootstrap.renderStatus)
initRpcTools({
  ensureRpc: bootstrap.ensureRpc,
  retryRpcCall: bootstrap.retryRpcCall,
  renderStatus: bootstrap.renderStatus
})

const { deriveLocked } = initInvoiceTools()
initPaymentVerification({ deriveLocked })
