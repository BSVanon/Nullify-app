import React from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import OfflineDeliveryHelper from "@/components/settings/HelperCacheSection.jsx";

export default function OverlayDiagnosticsSection({ overlayDiagnostics }) {
  if (!overlayDiagnostics) return null;

  return (
    <section className="space-y-6 text-sm">
      <header className="space-y-1.5">
        <h3 className="text-base font-semibold leading-none tracking-tight">
          Connection diagnostics
        </h3>
        <p className="text-sm text-muted-foreground">
          Quick check that live messaging, offline delivery, and background payments are working as expected.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {overlayDiagnostics.summary.map(({ id, label, value, tone }) => (
          <div
            key={id}
            className="rounded-md border border-muted-foreground/20 bg-muted/20 p-4"
          >
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
              <span>{label}</span>
              <Badge
                variant={tone === "danger" ? "destructive" : "outline"}
                className={cn(
                  "text-[10px]",
                  (tone === "ok" || tone === "online") &&
                    "border-emerald-500/60 bg-emerald-500/10 text-emerald-600",
                )}
              >
                {tone}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-foreground/80">{value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3 text-sm text-muted-foreground">
        {overlayDiagnostics.relays.map(
          ({ id, name, transport, status, lastSeen, reconnects, avgRtt }) => {
            const normalized = String(status || "").toLowerCase();
            const isOnline = normalized === "online";
            const isDown =
              normalized === "offline" || normalized === "disconnected";
            const displayStatus =
              normalized === "stub" || normalized === ""
                ? "local only"
                : status;

            return (
              <div
                key={id}
                className="flex flex-col gap-2 rounded-md border border-dashed border-muted-foreground/30 bg-muted/10 p-3"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground/80">{name}</p>
                    <p className="text-xs">Transport: {transport}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <Badge
                      variant={isDown ? "destructive" : "outline"}
                      className={cn(
                        "capitalize",
                        isOnline &&
                          "border-emerald-500/60 bg-emerald-500/10 text-emerald-600",
                      )}
                    >
                      {displayStatus}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span>Last seen: {lastSeen}</span>
                  {reconnects > 0 && (
                    <span className="text-amber-600 dark:text-amber-400">
                      Reconnects: {reconnects}
                    </span>
                  )}
                  {avgRtt != null && isOnline && (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Avg RTT: {avgRtt}ms
                    </span>
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>

      {import.meta?.env?.DEV && <OfflineDeliveryHelper />}
    </section>
  );
}
