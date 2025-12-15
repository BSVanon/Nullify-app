import React, { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function shortKey(key) {
  if (typeof key !== "string" || key.length <= 18) return key;
  return `${key.slice(0, 10)}…${key.slice(-6)}`;
}

export default function WalletConnectionSection({
  walletConnected,
  walletLoading,
  walletType,
  network,
  version,
  identityKey,
  connectionError,
  syncStatus,
  onConnect,
  onConnectBrc6,
}) {
  const connectionBadge = useMemo(() => {
    if (walletConnected) {
      return (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-100">
          <p className="font-medium">Wallet ready for on-chain actions</p>
          {identityKey && (
            <p className="flex items-center gap-2 text-xs opacity-80">
              <span>
                Identity key: <code>{shortKey(identityKey)}</code>
              </span>
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  try {
                    navigator?.clipboard?.writeText(identityKey);
                  } catch (error) {
                    console.warn("Failed to copy identity key", error);
                  }
                }}
              >
                Copy full key
              </Button>
            </p>
          )}
          <p className="mt-1 text-[11px] opacity-80">
            Set a spending cap in your wallet so on-chain thread setup and upgrades can stay quiet in the background.
          </p>
        </div>
      );
    }

    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-100">
        <p className="font-medium">No wallet connected (guest messaging still works)</p>
        <ul className="mt-1 list-disc space-y-1 pl-4 text-xs opacity-80">
          <li>Connect only when you need to set up on-chain access for threads or upgrade them to a holder wallet.</li>
          <li>
            No wallet installed? Get
            {' '}
            <a
              href="https://getmetanet.com/#desktop"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Metanet Desktop
            </a>
            {' '}
            and keep it running while you use Nullify.
          </li>
          <li>Start Metanet Desktop and enable the BRC-6 bridge when you want to use your wallet.</li>
          <li>
            If you have a BRC-7 browser wallet, ensure it injects window.CWI before loading the invite link.
          </li>
          <li>Set a spending cap in your wallet so approvals stay pre-authorized and mostly silent.</li>
        </ul>
      </div>
    );
  }, [walletConnected, identityKey]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallet connection</CardTitle>
        <CardDescription>
          Used for on-chain actions like creating thread access tokens or upgrading threads. Guest messaging works without a
          wallet; connect when needed and keep a spending cap set in your wallet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {connectionBadge}

        {connectionError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive dark:border-destructive/40 dark:bg-destructive/10">
            <p className="text-xs font-medium">{connectionError}</p>
            
            {/* Show browser-specific troubleshooting tips */}
            {/localhost|fetch|network|CORS|blocked|shields|privacy/i.test(connectionError) && (
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p className="font-medium">Common fixes:</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  <li><strong>Brave:</strong> Click the lion icon → "Allow all shields down for this site"</li>
                  <li><strong>Safari:</strong> Preferences → Privacy → uncheck "Prevent cross-site tracking"</li>
                  <li><strong>Firefox:</strong> Click shield icon in address bar → turn off Enhanced Tracking Protection</li>
                  <li><strong>Chrome:</strong> Usually works, but check extensions that block localhost</li>
                </ul>
                <p className="mt-1 opacity-80">
                  After changing settings, refresh this page and try connecting again.
                </p>
              </div>
            )}
            
            {/access control checks|not allowed to request resource/i.test(connectionError) && (
              <p className="mt-2 text-xs text-muted-foreground">
                Your browser is blocking Nullify from reaching your local wallet (Metanet Desktop on localhost:3321). 
                This happens when HTTPS pages try to call local HTTP ports. Try the browser-specific fixes above.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onConnect} disabled={walletLoading}>
            {walletLoading
              ? "Connecting…"
              : walletConnected
              ? "Reconnect wallet"
              : "Connect wallet"}
          </Button>
          {onConnectBrc6 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                try {
                  if (typeof window !== "undefined") {
                    window.open(
                      "https://getmetanet.com/#desktop",
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }
                } catch (error) {
                  console.warn("Failed to open Metanet site", error);
                }

                onConnectBrc6?.();
              }}
              disabled={walletLoading}
            >
              Get Metanet
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
