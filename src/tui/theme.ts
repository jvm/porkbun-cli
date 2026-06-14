/**
 * TUI theme - color/no-color/icon choices and semantic labels.
 */
import type { TerminalCapabilities } from "./types.js";

export interface Theme {
  // Colors (undefined when no-color)
  colors: {
    primary: string | undefined;
    secondary: string | undefined;
    success: string | undefined;
    warning: string | undefined;
    danger: string | undefined;
    info: string | undefined;
    muted: string | undefined;
    selected: string | undefined;
    selectedBg: string | undefined;
  };
  // Icons with plain-text fallbacks
  icons: {
    selected: string;
    unselected: string;
    check: string;
    cross: string;
    warning: string;
    info: string;
    loading: string;
    stale: string;
    arrow: string;
    bullet: string;
    locked: string;
    unlocked: string;
    web: string;
    billable: string;
    destructive: string;
  };
  // Labels for classifications
  labels: {
    readOnly: string;
    mutating: string;
    destructive: string;
    billable: string;
    webOnly: string;
    stale: string;
    error: string;
    selected: string;
  };
}

export function createTheme(caps: TerminalCapabilities): Theme {
  const hasColor = caps.color;
  const hasUnicode = caps.unicode;

  return {
    colors: {
      primary: hasColor ? "cyan" : undefined,
      secondary: hasColor ? "blue" : undefined,
      success: hasColor ? "green" : undefined,
      warning: hasColor ? "yellow" : undefined,
      danger: hasColor ? "red" : undefined,
      info: hasColor ? "blue" : undefined,
      muted: hasColor ? undefined : undefined,
      selected: hasColor ? "white" : undefined,
      selectedBg: hasColor ? "cyan" : undefined,
    },
    icons: {
      selected: hasUnicode ? "▸" : ">",
      unselected: " ",
      check: hasUnicode ? "✓" : "[OK]",
      cross: hasUnicode ? "✗" : "[X]",
      warning: hasUnicode ? "⚠" : "[!]",
      info: hasUnicode ? "ℹ" : "[i]",
      loading: hasUnicode ? "…" : "...",
      stale: hasUnicode ? "⟳" : "[stale]",
      arrow: hasUnicode ? "→" : "->",
      bullet: hasUnicode ? "•" : "-",
      locked: hasUnicode ? "🔒" : "[L]",
      unlocked: hasUnicode ? "🔓" : "[U]",
      web: hasUnicode ? "🌐" : "[web]",
      billable: hasUnicode ? "$" : "[$]",
      destructive: hasUnicode ? "⚠" : "[!!]",
    },
    labels: {
      readOnly: "read-only",
      mutating: "mutating",
      destructive: "destructive",
      billable: "billable",
      webOnly: "Not available in Porkbun API v3",
      stale: "stale",
      error: "error",
      selected: "selected",
    },
  };
}
