import React from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export default function ChatSettingsSection({ sendOnEnter, setSendOnEnter, typingIndicatorEnabled, setTypingIndicatorEnabled }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Threads & messaging</CardTitle>
        <CardDescription>Messaging shortcuts and thread defaults.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4">
          <div>
            <h3 className="font-medium">Send messages with Enter</h3>
            <p className="text-sm text-muted-foreground">
              When enabled, press Enter to send and Shift+Enter for a new line.
            </p>
          </div>
          <Switch checked={sendOnEnter} onCheckedChange={setSendOnEnter} />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4">
          <div>
            <h3 className="font-medium">Typing indicator</h3>
            <p className="text-sm text-muted-foreground">
              Show when you are typing and display incoming typing status.
            </p>
          </div>
          <Switch
            checked={typingIndicatorEnabled}
            onCheckedChange={setTypingIndicatorEnabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}
