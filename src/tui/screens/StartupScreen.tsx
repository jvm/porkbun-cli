/**
 * StartupScreen - authentication, profile selection, and ping validation.
 */
import React, { useState, useEffect } from "react";
import { Box, useInput } from "ink";
import { Text } from "../text.js";
import type { Theme } from "../theme.js";
import type { TuiApiService } from "../services/api.js";
import { listProfiles } from "../../lib/config.js";
import { LoadingState, ErrorState } from "../components/StatusComponents.js";

interface StartupScreenProps {
  service: TuiApiService;
  theme: Theme;
  onSuccess: (info: { yourIp: string; credentialsValid: boolean }) => void;
  credentialSource?: "flags" | "env" | "profile" | undefined;
  profileName?: string | undefined;
}

type StartupPhase = "profile-picker" | "validating" | "error";

export function StartupScreen({ service, theme, onSuccess, credentialSource }: StartupScreenProps) {
  const [phase, setPhase] = useState<StartupPhase>(
    credentialSource ? "validating" : "profile-picker",
  );
  const [profiles, setProfiles] = useState<string[]>([]);
  const [selectedProfile, setSelectedProfile] = useState(0);
  const [error, setError] = useState<Error | undefined>();

  // Load profiles if needed
  useEffect(() => {
    if (!credentialSource) {
      listProfiles()
        .then((p) => {
          setProfiles(p.map((x) => x.name));
          if (p.length === 0) {
            setPhase("error");
            setError(
              new Error("No credentials found. Run porkbun auth login to save credentials."),
            );
          } else if (p.length === 1) {
            setPhase("validating");
          }
        })
        .catch((err) => {
          setPhase("error");
          setError(err instanceof Error ? err : new Error(String(err)));
        });
    }
  }, [credentialSource]);

  // Validate credentials
  useEffect(() => {
    if (phase !== "validating") return;
    service.ping().then((result) => {
      if (result.status === "loaded" && result.data?.credentialsValid) {
        onSuccess(result.data);
      } else {
        setPhase("error");
        setError(
          new Error(result.error?.message ?? "Authentication failed. Credentials are not valid."),
        );
      }
    });
  }, [phase, service, onSuccess]);

  // Handle profile picker input
  useInput((char, key) => {
    if (phase === "profile-picker") {
      if (key.upArrow || char === "k") {
        setSelectedProfile((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow || char === "j") {
        setSelectedProfile((prev) => Math.min(profiles.length - 1, prev + 1));
      } else if (key.return) {
        setPhase("validating");
      } else if (char === "q") {
        process.exit(0);
      }
    } else if (phase === "error") {
      if (char === "r") {
        setPhase("validating");
        setError(undefined);
      } else if (char === "p") {
        setPhase("profile-picker");
        setError(undefined);
      } else if (char === "q") {
        process.exit(0);
      }
    }
  });

  if (phase === "validating") {
    return <LoadingState message="Validating credentials..." theme={theme} />;
  }

  if (phase === "error" && error) {
    return (
      <Box flexDirection="column" padding={1}>
        <ErrorState error={error} retryable theme={theme} />
        <Box marginTop={1}>
          <Text dimColor>
            [r] Retry
            {profiles.length > 0 && " | [p] Change profile"}
            {" | [q] Quit"}
          </Text>
        </Box>
      </Box>
    );
  }

  // Profile picker
  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.colors.primary} padding={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.colors.primary}>
          Select a profile:
        </Text>
      </Box>
      {profiles.map((profile, i) => (
        <Box key={profile}>
          <Text
            backgroundColor={i === selectedProfile ? theme.colors.selectedBg : undefined}
            color={i === selectedProfile ? theme.colors.selected : undefined}
          >
            {i === selectedProfile ? theme.icons.selected : theme.icons.unselected} {profile}
          </Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text dimColor>↑/↓ Navigate | Enter Select | q Quit</Text>
      </Box>
    </Box>
  );
}
