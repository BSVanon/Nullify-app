import React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useHelperCacheStatus } from "@/hooks/messaging/useHelperCacheStatus.js";

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, power);
  return `${value.toFixed(value >= 10 || power === 0 ? 0 : 1)} ${units[power]}`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours >= 24) {
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${Math.max(minutes, 1)} min`;
}

export default function OfflineDeliveryHelper() {
  const { supported, loading, error, usage, quota, status, pruning, refresh, prune } = useHelperCacheStatus({ autoRefresh: true });

  if (!supported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>P2P Offline Delivery Helper</CardTitle>
          <CardDescription>
            Temporary encrypted message storage for P2P delivery when a recipient is offline (not for multi-device sync).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Configure <code>HELPER_CACHE_ENDPOINT</code> to enable monitoring and auto-pruning for stored encrypted messages.
          </p>
          <p>
            Messages are stored temporarily (48h TTL) until recipients come online and fetch them.
          </p>
        </CardContent>
      </Card>
    );
  }

  const bytesPercent = usage?.bytes?.percent ?? null;
  const entriesPercent = usage?.entries?.percent ?? null;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>P2P Offline Delivery Helper</CardTitle>
          <CardDescription>
            Monitor storage usage, TTL policy, and clear old undelivered encrypted messages for P2P delivery.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
          <Button size="sm" onClick={prune} disabled={loading || pruning}>
            {pruning ? "Purging…" : "Purge undelivered messages"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {error && <p className="text-destructive">{error}</p>}

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Storage usage</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground/80">Bytes</span>
              <span className="text-muted-foreground">
                {formatBytes(usage?.bytes?.used)} / {formatBytes(quota?.limitBytes)}
              </span>
            </div>
            <Progress value={bytesPercent ?? 0} indicatorClassName="bg-emerald-500" />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Used</span>
              <span>{bytesPercent !== null ? `${bytesPercent}%` : "—"}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground/80">Entries</span>
              <span className="text-muted-foreground">
                {usage?.entries?.count ?? "—"} / {usage?.entries?.limit ?? "—"}
              </span>
            </div>
            <Progress value={entriesPercent ?? 0} indicatorClassName="bg-sky-500" />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Cached blobs</span>
              <span>{entriesPercent !== null ? `${entriesPercent}%` : "—"}</span>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-muted-foreground/20 bg-muted/10 p-3">
            <p className="text-xs font-medium text-muted-foreground">TTL policy</p>
            <p className="text-sm font-semibold text-foreground">
              {formatDuration(quota?.ttlSeconds)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Ciphertext expires automatically once the configured TTL elapses.
            </p>
          </div>
          <div className="rounded-lg border border-muted-foreground/20 bg-muted/10 p-3">
            <p className="text-xs font-medium text-muted-foreground">Last update</p>
            <p className="text-sm font-semibold text-foreground">
              {status?.updatedAt ? new Date(status.updatedAt).toLocaleString() : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Helper cache health endpoint reports uptime and total entries.
            </p>
          </div>
        </section>

        <section className="space-y-2 text-xs text-muted-foreground">
          <p>
            Status: <span className="font-medium text-foreground">{status?.status || 'unknown'}</span>
            {status?.uptime && ` · Uptime ${formatDuration(status.uptime)}`}
          </p>
          <p>
            Oldest entry: <span className="font-medium text-foreground">{quota?.oldestEntryIso ? new Date(quota.oldestEntryIso).toLocaleString() : '—'}</span>
          </p>
          <p>
            Most recent entry: <span className="font-medium text-foreground">{quota?.newestEntryIso ? new Date(quota.newestEntryIso).toLocaleString() : '—'}</span>
          </p>
        </section>
      </CardContent>
    </Card>
  );
}
