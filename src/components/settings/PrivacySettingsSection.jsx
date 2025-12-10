import React from "react";

import BlockedInviterList from "@/components/settings/BlockedInviterList.jsx";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function PrivacySettingsSection({
  remoteSyncPreference,
  remoteSyncStatus,
  setRemoteSyncEnabled,
  blockedInviters,
  unblockInviter,
  syncStatus,
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Privacy & Blocking</CardTitle>
        <CardDescription>
          Manage remote sync preferences and blocked inviters.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4">
          <div className="pr-4">
            <h3 className="font-medium">Multi-device vault sync</h3>
            <p className="text-sm text-muted-foreground">
              {remoteSyncPreference.configEnabled
                ? "Sync thread metadata across your devices via remote messaging service."
                : "Multi-device sync requires configuration. Provide REMOTE_MESSAGING_API_URL and enable the flag to opt in."}
            </p>
            {remoteSyncPreference.configEnabled ? (
              <p className="mt-1 text-xs text-muted-foreground/80">{remoteSyncStatus}</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground/80">
                Set <code className="rounded bg-muted px-1">VITE_REMOTE_MESSAGING_API_URL</code> and
                <code className="ml-1 rounded bg-muted px-1">VITE_REMOTE_MESSAGING_ENABLED=true</code> to enable remote sync.
              </p>
            )}
          </div>
          <Switch
            checked={remoteSyncPreference.effective}
            disabled={!remoteSyncPreference.configEnabled}
            onCheckedChange={setRemoteSyncEnabled}
          />
        </div>

        <BlockedInviterList
          blockedInviters={blockedInviters}
          onUnblock={unblockInviter}
          syncStatus={syncStatus}
        />
      </CardContent>
    </Card>
  );
}
