import React from "react";

import { cn } from "@/lib/utils";

function getAcronym(label = "") {
  const words = label
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "?";
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function SettingsSidebarSection({
  section,
  isActive,
  onSelect,
}) {
  const Icon = section.icon;

  return (
    <button
      type="button"
      onClick={() => onSelect(section.id)}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-3 text-left transition",
        isActive
          ? "bg-primary/10 text-primary"
          : "hover:bg-muted"
      )}
    >
      {Icon && <Icon className="h-5 w-5" />}
      <div className="flex-1">
        <p className="text-sm font-medium leading-tight text-foreground">
          {section.label}
        </p>
      </div>
    </button>
  );
}

export default function SettingsSidebarSectionList({
  sections,
  activeSectionId,
  onSelectSection,
}) {
  if (!sections?.length) {
    return (
      <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/10 p-6 text-sm text-muted-foreground">
        No settings categories defined yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sections.map((section) => (
        <SettingsSidebarSection
          key={section.id}
          section={section}
          isActive={section.id === activeSectionId}
          onSelect={onSelectSection}
        />
      ))}
    </div>
  );
}
