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
                      <p className="text-xs text-destructive">{errorMessage}</p>
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
