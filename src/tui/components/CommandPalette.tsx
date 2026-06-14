/**
 * CommandPalette - searchable command palette filtered by current context
 */
import React, { useState, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { Theme } from "../theme.js";

export interface Command {
  id: string;
  name: string;
  description: string;
  classification: "read-only" | "mutating" | "destructive" | "billable" | "web-only";
  disabled?: boolean;
  disabledReason?: string;
  onExecute: () => void;
}

interface CommandPaletteProps {
  theme: Theme;
  commands: Command[];
  onClose: () => void;
}

export function CommandPalette({ theme, commands, onClose }: CommandPaletteProps) {
  const [searchText, setSearchText] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = useMemo(() => {
    if (!searchText) return commands;
    const lower = searchText.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(lower) ||
        cmd.description.toLowerCase().includes(lower) ||
        cmd.classification.includes(lower),
    );
  }, [commands, searchText]);

  useInput((char, key) => {
    if (key.escape) {
      onClose();
      return;
    }

    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex((prev) => prev - 1);
    } else if (key.downArrow && selectedIndex < filteredCommands.length - 1) {
      setSelectedIndex((prev) => prev + 1);
    } else if (key.return) {
      const cmd = filteredCommands.at(selectedIndex);
      if (cmd && !cmd.disabled) {
        onClose();
        cmd.onExecute();
      }
    }
  });

  const getClassificationColor = (classification: Command["classification"]) => {
    switch (classification) {
      case "read-only":
        return theme.colors.info;
      case "mutating":
        return theme.colors.warning;
      case "destructive":
        return theme.colors.danger;
      case "billable":
        return theme.colors.danger;
      case "web-only":
        return theme.colors.muted;
    }
  };

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.colors.primary} padding={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.colors.primary}>
          Command Palette
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>Search: </Text>
        <TextInput value={searchText} onChange={setSearchText} placeholder="Type to filter..." />
      </Box>

      <Box flexDirection="column" maxHeight={15}>
        {filteredCommands.length === 0 ? (
          <Text dimColor>No commands found</Text>
        ) : (
          filteredCommands.map((cmd, index) => (
            <Box key={cmd.id}>
              <Text
                backgroundColor={index === selectedIndex ? theme.colors.selectedBg : undefined}
                color={index === selectedIndex ? theme.colors.selected : undefined}
              >
                {index === selectedIndex ? "▸ " : "  "}
                {cmd.name}
              </Text>
              <Text dimColor> - {cmd.description}</Text>
              <Text color={getClassificationColor(cmd.classification)}>
                {" "}
                [{cmd.classification}]
              </Text>
              {cmd.disabled && (
                <Text color={theme.colors.muted}> ({cmd.disabledReason || "disabled"})</Text>
              )}
            </Box>
          ))
        )}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>↑↓: Navigate | Enter: Execute | Esc: Close</Text>
      </Box>
    </Box>
  );
}
