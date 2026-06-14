/**
 * ContextHelp - contextual help listing current keys, action descriptions, and safety implications
 */
import React from "react";
import { Box, useInput } from "ink";
import { Text } from "../text.js";
import type { Theme } from "../theme.js";

interface ContextHelpProps {
  theme: Theme;
  context: string;
  onClose: () => void;
}

export function ContextHelp({ theme, context, onClose }: ContextHelpProps) {
  useInput((char, key) => {
    if (key.escape || char === "q") {
      onClose();
    }
  });

  const helpContent = getHelpForContext(context);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.colors.primary} padding={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.colors.primary}>
          Help: {context}
        </Text>
      </Box>

      <Box flexDirection="column">
        <Text bold>Global Keys:</Text>
        <Text> ↑/↓ or j/k Navigate lists</Text>
        <Text> Enter Open item or submit form</Text>
        <Text> Esc or q Go back or cancel</Text>
        <Text> Tab/Shift+Tab Move between fields</Text>
        <Text> Space Toggle selection</Text>
        <Text> / Search</Text>
        <Text> : Command palette</Text>
        <Text> r Refresh current view</Text>
        <Text> ? This help screen</Text>
        <Text> Ctrl+C Quit</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Context-Specific Keys:</Text>
        {helpContent.map((item, index) => (
          <Text key={index}>
            {" "}
            {item.key.padEnd(15)} {item.description}
          </Text>
        ))}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold color={theme.colors.warning}>
          Safety:
        </Text>
        <Text dimColor> • All mutations require review and confirmation</Text>
        <Text dimColor> • Billable operations require typing the domain name</Text>
        <Text dimColor> • Destructive operations require explicit confirmation</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold color={theme.colors.muted}>
          Web-Only Features:
        </Text>
        <Text dimColor> The following are NOT available in Porkbun API v3:</Text>
        <Text dimColor> • Domain contacts, registrar lock/unlock</Text>
        <Text dimColor> • Transfer-out authorization</Text>
        <Text dimColor> • WHOIS privacy mode</Text>
        <Text dimColor> • Labels editing (read-only)</Text>
        <Text dimColor> • API access toggles</Text>
        <Text dimColor> • Parking, pushes, hosting</Text>
        <Text dimColor> • Marketplace management</Text>
        <Text dimColor> • Domain deletion</Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Press Esc or q to close</Text>
      </Box>
    </Box>
  );
}

function getHelpForContext(context: string): Array<{ key: string; description: string }> {
  switch (context) {
    case "domains":
      return [
        { key: "a", description: "Toggle auto-renew for selected domain(s)" },
        { key: "Space", description: "Select/deselect domain" },
        { key: "1-4", description: "Switch navigation tabs" },
      ];
    case "domain-detail":
      return [
        { key: "←/→ or h/l", description: "Switch tabs" },
        { key: "c", description: "Create DNS record (DNS tab)" },
        { key: "e", description: "Edit DNS record (DNS tab)" },
        { key: "d", description: "Delete DNS record (DNS tab)" },
        { key: "n", description: "Edit nameservers (Nameservers tab)" },
        { key: "R", description: "Renew domain (Overview tab)" },
        { key: "e", description: "Export SSL bundle (SSL tab)" },
      ];
    case "register":
      return [
        { key: "Enter", description: "Check availability or confirm registration" },
        { key: "Esc", description: "Cancel registration" },
      ];
    case "transfers":
      return [
        { key: "n", description: "Initiate new transfer" },
        { key: "r", description: "Refresh transfer list" },
      ];
    default:
      return [];
  }
}
