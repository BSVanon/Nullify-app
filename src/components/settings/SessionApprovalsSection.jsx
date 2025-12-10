import React from "react";

export default function SessionApprovalsSection() {
  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">Session approvals & spend caps</p>
      <p>
        Your wallet is called for all spending to create new threads, burn existing threads and create bitcoin
        transfers. There are no other charges or per-message fees within a thread.
      </p>
      <p className="text-xs">
        To change spend caps, open your wallet and adjust session or policy settings there.
      </p>
    </div>
  );
}
