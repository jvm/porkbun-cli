/**
 * App - root React component that receives injected services, runtime options,
 * terminal capabilities, and initial route.
 */
import React, { useState, useCallback } from "react";
import { Box, useInput } from "ink";
import { Text } from "./text.js";
import type { TerminalCapabilities } from "./types.js";
import type { Theme } from "./theme.js";
import type { TuiApiService } from "./services/api.js";
import { AppFrame } from "./components/AppFrame.js";
import { KeyHelp } from "./components/StatusComponents.js";
import { StartupScreen } from "./screens/StartupScreen.js";
import { DomainsScreen } from "./screens/DomainsScreen.js";
import { DomainDetailScreen } from "./screens/DomainDetailScreen.js";
import { RegisterScreen } from "./screens/RegisterScreen.js";
import { TransfersScreen } from "./screens/TransfersScreen.js";
import { GLOBAL_KEYS } from "./keymap.js";

type Screen =
  | { name: "startup" }
  | { name: "domains" }
  | { name: "domain-detail"; domain: string }
  | { name: "transfers" }
  | { name: "register" }
  | { name: "account" }
  | { name: "help" };

interface AppProps {
  service: TuiApiService;
  theme: Theme;
  terminal: TerminalCapabilities;
  credentialSource?: "flags" | "env" | "profile" | undefined;
  profileName?: string | undefined;
}

export function App({ service, theme, terminal, credentialSource, profileName }: AppProps) {
  const [screen, setScreen] = useState<Screen>({ name: "startup" });
  const [history, setHistory] = useState<Screen[]>([]);
  const [balanceCents, setBalanceCents] = useState<number | undefined>();

  const navigate = useCallback(
    (next: Screen) => {
      setHistory((prev) => [...prev, screen]);
      setScreen(next);
    },
    [screen],
  );

  const goBack = useCallback(() => {
    const prev = history.at(-1);
    if (!prev) {
      setScreen({ name: "domains" });
      return;
    }
    setHistory((h) => h.slice(0, -1));
    setScreen(prev);
  }, [history]);

  const handleStartupSuccess = useCallback(
    (info: { yourIp: string; credentialsValid: boolean }) => {
      // The info is currently only used for diagnostics; the next screen
      // doesn't surface it. Touch both fields so the linter doesn't
      // flag the destructured arg as unused while we keep the signature
      // matching the StartupScreen contract.
      void info.yourIp;
      void info.credentialsValid;
      setScreen({ name: "domains" });
      // Load balance in background
      service.getBalance().then((result) => {
        if (result.status === "loaded" && result.data) {
          setBalanceCents(result.data.balanceCents);
        }
      });
    },
    [service],
  );

  // Global key handling
  useInput((char, key) => {
    if (key.ctrl && char === "c") {
      process.exit(0);
    }
  });

  // Render current screen
  let main: React.ReactNode;
  switch (screen.name) {
    case "startup":
      main = (
        <StartupScreen
          service={service}
          theme={theme}
          onSuccess={handleStartupSuccess}
          credentialSource={credentialSource}
          profileName={profileName}
        />
      );
      break;
    case "domains":
      main = (
        <DomainsScreen
          service={service}
          theme={theme}
          onOpenDomain={(domain) => navigate({ name: "domain-detail", domain })}
          onOpenTransfers={() => navigate({ name: "transfers" })}
          onOpenRegister={() => navigate({ name: "register" })}
          onOpenAccount={() => navigate({ name: "account" })}
          onOpenHelp={() => navigate({ name: "help" })}
          balanceCents={balanceCents}
        />
      );
      break;
    case "domain-detail":
      main = (
        <DomainDetailScreen
          service={service}
          theme={theme}
          domain={screen.domain}
          onBack={goBack}
        />
      );
      break;
    case "transfers":
      main = (
        <TransfersScreen
          service={service}
          theme={theme}
          balanceCents={balanceCents}
          onSuccess={() => {
            // Refresh balance after successful transfer
            service.getBalance().then((result) => {
              if (result.status === "loaded" && result.data) {
                setBalanceCents(result.data.balanceCents);
              }
            });
            goBack();
          }}
          onCancel={goBack}
        />
      );
      break;
    case "register":
      main = (
        <RegisterScreen
          service={service}
          theme={theme}
          balanceCents={balanceCents}
          onSuccess={() => {
            // Refresh balance after successful registration
            service.getBalance().then((result) => {
              if (result.status === "loaded" && result.data) {
                setBalanceCents(result.data.balanceCents);
              }
            });
            goBack();
          }}
          onCancel={goBack}
        />
      );
      break;
    case "account":
      main = <AccountScreen theme={theme} balanceCents={balanceCents} onBack={goBack} />;
      break;
    case "help":
      main = <HelpScreen theme={theme} onBack={goBack} />;
      break;
  }

  // Header
  const header = (
    <Header
      theme={theme}
      profileName={profileName}
      credentialSource={credentialSource}
      balanceCents={balanceCents}
    />
  );

  // Footer
  const footer = (
    <KeyHelp
      bindings={GLOBAL_KEYS.filter((k) => k.context === "global").map((k) => ({
        key: k.key,
        label: k.label,
        description: k.description,
      }))}
      theme={theme}
    />
  );

  return <AppFrame terminal={terminal} theme={theme} header={header} main={main} footer={footer} />;
}

function Header({
  theme,
  profileName,
  credentialSource,
  balanceCents,
}: {
  theme: Theme;
  profileName?: string | undefined;
  credentialSource?: "flags" | "env" | "profile" | undefined;
  balanceCents?: number | undefined;
}) {
  return (
    <Box justifyContent="space-between" width="100%">
      <Box>
        <Text bold color={theme.colors.primary}>
          Porkbun TUI
        </Text>
        {profileName && <Text dimColor> | Profile: {profileName}</Text>}
        {credentialSource && <Text dimColor> | Source: {credentialSource}</Text>}
      </Box>
      <Box>
        {balanceCents !== undefined && (
          <Text dimColor>Balance: ${(balanceCents / 100).toFixed(2)}</Text>
        )}
      </Box>
    </Box>
  );
}

function AccountScreen({
  theme,
  balanceCents,
  onBack,
}: {
  theme: Theme;
  balanceCents?: number | undefined;
  onBack: () => void;
}) {
  useInput((char, key) => {
    if (key.escape || char === "q") onBack();
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color={theme.colors.primary}>
        Account
      </Text>
      <Box marginTop={1}>
        <Text dimColor>Balance: </Text>
        <Text>
          {balanceCents !== undefined
            ? `$${(balanceCents / 100).toFixed(2)} (${balanceCents} cents)`
            : "(loading...)"}
        </Text>
      </Box>
    </Box>
  );
}

function HelpScreen({ theme, onBack }: { theme: Theme; onBack: () => void }) {
  useInput((char, key) => {
    if (key.escape || char === "q") onBack();
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color={theme.colors.primary}>
        Help
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Text>Navigation:</Text>
        <Text dimColor> ↑/↓/j/k: Navigate lists</Text>
        <Text dimColor> Enter: Open item</Text>
        <Text dimColor> Space: Toggle selection</Text>
        <Text dimColor> Esc/q: Go back</Text>
        <Text dimColor> /: Search</Text>
        <Text dimColor> r: Refresh</Text>
        <Text dimColor> ?: Help</Text>
        <Text dimColor> :: Command palette (coming soon)</Text>
        <Text dimColor> Ctrl+C: Quit</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text>Web-only features (not available in Porkbun API v3):</Text>
        <Text dimColor> Domain contacts, registrar lock/unlock, transfer-out auth,</Text>
        <Text dimColor> WHOIS privacy mode, labels editing, API access toggles,</Text>
        <Text dimColor> parking, pushes, hosting, marketplace management, deletion.</Text>
      </Box>
    </Box>
  );
}
