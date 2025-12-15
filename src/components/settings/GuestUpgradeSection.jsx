import React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function GuestUpgradeSection({
  guestThreads,
  upgradingThreadId,
  upgradeErrorByThread,
  walletLoading,
  onUpgrade,
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Guest conversations you can link to your wallet</CardTitle>
        <CardDescription>
          These are chats running in guest mode. Linking them to your wallet lets you keep using them after you switch
          devices and send your own invites, using a small on-chain action approved by your wallet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {guestThreads.length === 0 ? (
          <p className="text-muted-foreground">
            All threads are already wallet-linked. No action required.
          </p>
        ) : (
          guestThreads.map((thread) => {
            const upgrading = upgradingThreadId === thread.id;
            const errorMessage = upgradeErrorByThread[thread.id];

            return (
              <div
                key={thread.id}
                className="rounded-lg border border-border/60 bg-muted/10 px-4 py-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{thread.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Status: {thread.status === "ready" ? "Guest ready" : thread.status}
                    </p>
                    {errorMessage && (
                      <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                        <p className="text-xs font-medium text-destructive">{errorMessage}</p>
                        
                        {/* Show browser-specific troubleshooting tips for wallet connection issues */}
                        {/localhost|fetch|network|CORS|blocked|shields|privacy|Cannot reach|Browser blocked/i.test(errorMessage) && (
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            <p className="font-medium">Common fixes:</p>
                            <ul className="list-disc space-y-0.5 pl-4">
                              <li><strong>Brave:</strong> Click the lion icon → "Allow all shields down for this site"</li>
                              <li><strong>Safari:</strong> Preferences → Privacy → uncheck "Prevent cross-site tracking"</li>
                              <li><strong>Firefox:</strong> Click shield icon in address bar → turn off Enhanced Tracking Protection</li>
                              <li><strong>Chrome:</strong> Usually works, but check extensions that block localhost</li>
                            </ul>
                            <p className="mt-1 opacity-80">
                              After changing settings, refresh this page and try again.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => onUpgrade(thread.id)}
                      disabled={walletLoading || upgrading}
                    >
                      {upgrading ? "Linking…" : "Link this chat to my wallet"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
