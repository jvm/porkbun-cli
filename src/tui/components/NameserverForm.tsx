import React, { useState } from "react";
import { Box, useInput } from "ink";
import { Text } from "../text.js";
import TextInput from "ink-text-input";
import type { Theme } from "../theme.js";

export interface NameserverFormProps {
  theme: Theme;
  initialNameservers: string[];
  onSubmit: (nameservers: string[]) => void;
  onCancel: () => void;
}

export function NameserverForm({
  theme,
  initialNameservers,
  onSubmit,
  onCancel,
}: NameserverFormProps) {
  const [nameservers, setNameservers] = useState<string[]>(
    initialNameservers.length > 0 ? initialNameservers : [""],
  );
  const [focusedIndex, setFocusedIndex] = useState(0);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.upArrow) {
      setFocusedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setFocusedIndex((prev) => Math.min(nameservers.length - 1, prev + 1));
    } else if (key.return) {
      const validNameservers = nameservers.filter((ns) => ns.trim() !== "");
      if (validNameservers.length > 0) {
        onSubmit(validNameservers);
      }
    } else if (input === "a") {
      // Add new nameserver
      setNameservers([...nameservers, ""]);
      setFocusedIndex(nameservers.length);
    } else if (input === "d" && nameservers.length > 1) {
      // Delete current nameserver
      const newNameservers = nameservers.filter((_, idx) => idx !== focusedIndex);
      setNameservers(newNameservers);
      setFocusedIndex(Math.max(0, focusedIndex - 1));
    }
  });

  const updateNameserver = (index: number, value: string) => {
    setNameservers([...nameservers.slice(0, index), value, ...nameservers.slice(index + 1)]);
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Update Nameservers</Text>
      <Box marginTop={1} flexDirection="column">
        {nameservers.map((ns, idx) => (
          <Box key={idx} marginBottom={0}>
            <Text color={idx === focusedIndex ? theme.colors.primary : undefined}>
              {idx === focusedIndex ? "▶ " : "  "}
              NS{idx + 1}:{" "}
            </Text>
            {idx === focusedIndex ? (
              <TextInput value={ns} onChange={(value) => updateNameserver(idx, value)} />
            ) : (
              <Text>{ns || "(empty)"}</Text>
            )}
          </Box>
        ))}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>↑↓: navigate | a: add | d: delete | Enter: submit | Esc: cancel</Text>
      </Box>
    </Box>
  );
}
