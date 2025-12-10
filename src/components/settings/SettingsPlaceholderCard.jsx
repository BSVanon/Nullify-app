import React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Generic placeholder card for settings sections that are not yet implemented.
 * Helps surface upcoming categories while keeping layout consistent.
 */
export default function SettingsPlaceholderCard({
  title,
  description = "Configuration options coming soon.",
  items = [],
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        {Array.isArray(items) && items.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5">
            {items.map((item, index) => (
              <li key={`${title}-item-${index}`}>{item}</li>
            ))}
          </ul>
        ) : (
          <p>{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
