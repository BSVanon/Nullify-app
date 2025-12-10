import React from 'react'
import { ExternalLink, Key, Shield, Flame } from 'lucide-react'
import { 
  formatOutpoint, 
  getBlockchainExplorerUrl,
  getAccessStatusMessage 
} from '@/lib/messaging/validateThreadAccess'

/**
 * ThreadTokenInfo - Display CT/DT access-token information for this thread.
 * 
 * This component visualizes the CT/DT primitive to demonstrate:
 * - Control Token (CT) = Thread ownership
 * - Data Token (DT) = Access rights
 * - On-chain verification links
 * - Burn proof for revoked access
 */
export default function ThreadTokenInfo({ thread }) {
  if (!thread) return null

  const { ctOutpoint, dtOutpoints, dtRecipientCount, status, burnTxid, burnedAt } = thread
  const hasCT = ctOutpoint?.txid
  const hasDT = dtOutpoints && dtOutpoints.length > 0

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-muted-foreground/20">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Shield className="w-4 h-4" />
        <span>Thread access tokens (advanced view)</span>
      </div>

      {/* Access Status */}
      <div className="text-sm">
        <div className="font-medium mb-1">Access Status</div>
        <div className={`flex items-center gap-2 ${
          status === 'burned' ? 'text-red-500' : 'text-green-500'
        }`}>
          {status === 'burned' && <Flame className="w-4 h-4" />}
          {getAccessStatusMessage({ status })}
        </div>
      </div>

      {/* Control Token (CT) */}
      {hasCT && (
        <div className="text-sm space-y-1">
          <div className="flex items-center gap-2 font-medium">
            <Key className="w-4 h-4" />
            <span>Thread access control token</span>
          </div>
          <div className="pl-6 space-y-1">
            <div className="text-xs text-muted-foreground">
              Outpoint: <code className="text-xs">{formatOutpoint(ctOutpoint)}</code>
            </div>
            <a
              href={getBlockchainExplorerUrl(ctOutpoint)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
            >
              <ExternalLink className="w-3 h-3" />
              View on WhatsOnChain
            </a>
          </div>
        </div>
      )}

      {/* Data Tokens (DT) */}
      <div className="text-sm space-y-1">
        <div className="flex items-center gap-2 font-medium">
          <Shield className="w-4 h-4" />
          <span>Participant access tokens</span>
        </div>
        <div className="pl-6 space-y-1">
          {hasDT ? (
            <>
              <div className="text-xs text-muted-foreground">
                {dtRecipientCount} recipient{dtRecipientCount !== 1 ? 's' : ''} with access tokens
              </div>
              {dtOutpoints.slice(0, 3).map((dt, idx) => (
                <div key={idx} className="text-xs">
                  <code className="text-xs">{formatOutpoint({ txid: dt.txid, vout: dt.vout })}</code>
                  {dt.recipientPubkey && (
                    <span className="text-muted-foreground ml-2">
                      → {dt.recipientPubkey.slice(0, 8)}...
                    </span>
                  )}
                </div>
              ))}
              {dtOutpoints.length > 3 && (
                <div className="text-xs text-muted-foreground">
                  +{dtOutpoints.length - 3} more...
                </div>
              )}
            </>
          ) : (
            <div className="text-xs text-muted-foreground">
              {dtRecipientCount > 0 
                ? `${dtRecipientCount} recipient${dtRecipientCount !== 1 ? 's' : ''} (outpoints not loaded)`
                : 'No data tokens minted yet'}
            </div>
          )}
        </div>
      </div>

      {/* Burn Proof */}
      {status === 'burned' && burnTxid && (
        <div className="text-sm space-y-1 border-t border-muted-foreground/20 pt-3">
          <div className="flex items-center gap-2 font-medium text-red-500">
            <Flame className="w-4 h-4" />
            <span>Burn Proof (On-Chain)</span>
          </div>
          <div className="pl-6 space-y-1">
            <div className="text-xs text-muted-foreground">
              Burned: {burnedAt ? new Date(burnedAt).toLocaleString() : 'Unknown'}
            </div>
            <div className="text-xs text-muted-foreground">
              Burn TX: <code className="text-xs">{burnTxid.slice(0, 16)}...</code>
            </div>
            <a
              href={getBlockchainExplorerUrl({ txid: burnTxid })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
            >
              <ExternalLink className="w-3 h-3" />
              Verify Burn on Blockchain
            </a>
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground italic border-t border-muted-foreground/20 pt-3">
        On-chain access-token system: Provable access revocation via token burning
      </div>
    </div>
  )
}
