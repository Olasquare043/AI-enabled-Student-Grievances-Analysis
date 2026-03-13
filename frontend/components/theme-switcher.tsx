"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function ThemeSwitcher() {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const activeTheme = mounted ? theme : undefined;
  const themeLabel = !mounted
    ? "Theme"
    : theme === "system"
      ? `System (${resolvedTheme ?? "auto"})`
      : (theme ?? "Theme");

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/80 p-1 shadow-sm backdrop-blur">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "size-8 rounded-full",
          activeTheme === "light" && "bg-primary text-primary-foreground hover:bg-primary/90",
        )}
        onClick={() => setTheme("light")}
        aria-label="Switch to light mode"
        title="Light mode"
      >
        <Sun className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "size-8 rounded-full",
          activeTheme === "dark" && "bg-primary text-primary-foreground hover:bg-primary/90",
        )}
        onClick={() => setTheme("dark")}
        aria-label="Switch to dark mode"
        title="Dark mode"
      >
        <Moon className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "size-8 rounded-full",
          activeTheme === "system" && "bg-primary text-primary-foreground hover:bg-primary/90",
        )}
        onClick={() => setTheme("system")}
        aria-label="Follow system theme"
        title="System theme"
      >
        <Monitor className="size-4" />
      </Button>
      <span className="hidden pr-2 text-xs font-medium text-muted-foreground sm:inline">
        {themeLabel}
      </span>
    </div>
  );
}
