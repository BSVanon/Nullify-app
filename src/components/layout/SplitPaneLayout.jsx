import React from "react";

import { cn } from "@/lib/utils";

/**
 * Generic two-pane layout with a fixed-width sidebar on the left and
 * scrollable content on the right. Mirrors the Messages page shell so
 * sections can share consistent structure.
 */
export default function SplitPaneLayout({
  sidebar,
  children,
  className,
  sidebarClassName,
  contentClassName,
  minHeight = "min-h-[640px]",
}) {
  return (
    <div className={cn("flex h-full flex-1 overflow-hidden bg-background", minHeight, className)}>
      <aside
        className={cn(
          "flex w-[280px] flex-shrink-0 flex-col border-r border-border/60 bg-muted/10",
          "overflow-hidden",
          sidebarClassName,
        )}
      >
        {sidebar}
      </aside>
      <main
        className={cn(
          "flex flex-1 flex-col overflow-hidden",
          contentClassName,
        )}
      >
        {children}
      </main>
    </div>
  );
}
