import React, { useState } from "react";
import { Box, useInput } from "ink";
import { Text } from "../text.js";
import type { NormalizedGlueRecord } from "../types.js";
import type { Theme } from "../theme.js";

export interface GlueTabProps {
  records: NormalizedGlueRecord[];
  theme: Theme;
  onCreate: () => void;
  onEdit: (record: NormalizedGlueRecord) => void;
  onDelete: (record: NormalizedGlueRecord) => void;
}

export function GlueTab({ records, theme, onCreate, onEdit, onDelete }: GlueTabProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (input === "n") {
      onCreate();
      return;
    }

    if (input === "e" && records.at(selectedIndex)) {
      onEdit(records.at(selectedIndex)!);
      return;
    }

    if (input === "d" && records.at(selectedIndex)) {
      onDelete(records.at(selectedIndex)!);
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.max(0, Math.min(records.length - 1, prev + 1)));
    }
  });

  if (records.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>No glue records found.</Text>
        <Text dimColor>Press 'n' to create a new glue record.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Glue Records</Text>
      <Box marginTop={1} flexDirection="column">
        {records.map((record, idx) => (
          <Box key={record.hostname}>
            <Text color={idx === selectedIndex ? theme.colors.primary : undefined}>
              {idx === selectedIndex ? "▶ " : "  "}
              {record.hostname}: {record.ips.join(", ")}
            </Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>↑↓: navigate | n: new | e: edit | d: delete</Text>
      </Box>
    </Box>
  );
}
