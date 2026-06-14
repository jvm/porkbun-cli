/**
 * TUI entry point - TTY checks, terminal lifecycle, Ink render/unmount.
 */
import { render } from "ink";
import React from "react";
import { CliError } from "../lib/errors.js";
import { ApiClient } from "../lib/api-client.js";
import { resolveCredentials } from "../lib/config.js";
import { TuiApiService } from "./services/api.js";
import { createTheme } from "./theme.js";
import { App } from "./app.js";
import type { TerminalCapabilities } from "./types.js";

export interface LaunchTuiOptions {
  apiKey?: string | undefined;
  secretApiKey?: string | undefined;
  profile?: string | undefined;
  baseUrl?: string | undefined;
  ipv4?: boolean | undefined;
  timeout?: number | undefined;
  verbose?: boolean | undefined;
  noColor?: boolean | undefined;
}

/**
 * Launch the TUI. Validates TTY, resolves credentials, enters alternate screen,
 * and renders the Ink app.
 */
export async function launchTui(options: LaunchTuiOptions = {}): Promise<void> {
  // TTY validation
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new CliError({
      kind: "usage",
      message:
        "The TUI requires an interactive terminal (TTY). Use named commands for non-interactive usage.",
    });
  }

  // Determine terminal capabilities
  const terminal: TerminalCapabilities = {
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
    color: !options.noColor && !process.env.NO_COLOR && process.stdout.hasColors?.() !== false,
    unicode: !process.env.NO_UNICODE && process.platform !== "win32",
  };

  // Resolve credential source for display
  let credentialSource: "flags" | "env" | "profile" | undefined;
  let profileName: string | undefined;

  if (options.apiKey || options.secretApiKey) {
    credentialSource = "flags";
  } else if (process.env.PORKBUN_API_KEY || process.env.PORKBUN_SECRET_API_KEY) {
    credentialSource = "env";
  } else {
    credentialSource = "profile";
    const creds = await resolveCredentials({ profile: options.profile }, false);
    profileName = creds?.profile;
  }

  // Create API client
  const client = new ApiClient({
    apiKey: options.apiKey,
    secretApiKey: options.secretApiKey,
    profile: options.profile,
    baseUrl: options.baseUrl,
    ipv4: options.ipv4,
    timeoutMs: options.timeout,
    verbose: options.verbose,
  });

  // Create TUI service
  const service = new TuiApiService(client);

  // Create theme
  const theme = createTheme(terminal);

  // Enter alternate screen
  process.stdout.write("\x1B[?1049h");

  // Setup cleanup handlers
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    // Exit alternate screen
    process.stdout.write("\x1B[?1049l");
    // Restore cursor
    process.stdout.write("\x1B[?25h");
    // Reset terminal state
    process.stdout.write("\x1B[0m");
  };

  // Handle Ctrl+C, uncaught errors, and normal exit
  const handleSignal = () => {
    cleanup();
    process.exit(0);
  };

  const handleUncaughtException = (err: Error) => {
    cleanup();
    process.stderr.write(`\nTUI error: ${err.message}\n`);
    process.exit(1);
  };

  process.on("SIGINT", handleSignal);
  process.on("uncaughtException", handleUncaughtException);
  process.on("exit", cleanup);

  try {
    // Render the app
    const { waitUntilExit } = render(
      <App
        service={service}
        theme={theme}
        terminal={terminal}
        credentialSource={credentialSource}
        profileName={profileName}
      />,
      {
        stdout: process.stdout,
        stdin: process.stdin,
        exitOnCtrlC: true,
      },
    );

    await waitUntilExit();
  } catch (err) {
    cleanup();
    // If startup was rejected, restore terminal before re-throwing
    if (err instanceof CliError) {
      throw err;
    }
    throw new CliError({
      kind: "api_error",
      message: `TUI failed to start: ${err instanceof Error ? err.message : String(err)}`,
    });
  } finally {
    cleanup();
    process.removeListener("SIGINT", handleSignal);
    process.removeListener("uncaughtException", handleUncaughtException);
    process.removeListener("exit", cleanup);
  }
}
