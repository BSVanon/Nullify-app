import React from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext.jsx";

const THEME_OPTIONS = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

const TEXT_SCALE_OPTIONS = [
  { id: "sm", label: "Small" },
  { id: "md", label: "Default" },
  { id: "lg", label: "Large" },
];

export default function AppearanceSettingsSection() {
  const { theme, setTheme, textScale = "md", setTextScale } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Theme and text size on this device.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-medium">Theme</h3>
            <p className="text-sm text-muted-foreground">
              Switch between light, dark, or follow your system setting.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {THEME_OPTIONS.map((option) => (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={theme === option.id ? "default" : "outline"}
                onClick={() => setTheme(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-medium">Text size</h3>
            <p className="text-sm text-muted-foreground">
              Adjust chat text and thread previews.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {TEXT_SCALE_OPTIONS.map((option) => (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={textScale === option.id ? "default" : "outline"}
                onClick={() => setTextScale(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
