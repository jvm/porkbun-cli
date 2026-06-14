import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { NormalizedForward } from '../types.js';

export interface ForwardsTabProps {
  forwards: NormalizedForward[];
  theme: any;
  onCreate: () => void;
  onDelete: (forward: NormalizedForward) => void;
}

export function ForwardsTab({ forwards, theme, onCreate, onDelete }: ForwardsTabProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (input === 'n') {
      onCreate();
      return;
    }

    if (input === 'd' && forwards.at(selectedIndex)) {
      onDelete(forwards.at(selectedIndex)!);
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(forwards.length - 1, prev + 1));
    }
  });

  if (forwards.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>No URL forwards found.</Text>
        <Text dimColor>Press 'n' to create a new forward.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>URL Forwards</Text>
      <Box marginTop={1} flexDirection="column">
        {forwards.map((forward, idx) => (
          <Box key={forward.id}>
            <Text color={idx === selectedIndex ? theme.colors.primary : undefined}>
              {idx === selectedIndex ? '▶ ' : '  '}
              {forward.subdomain || '(root)'} → {forward.location} ({forward.type})
            </Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>↑↓: navigate | n: new | d: delete</Text>
      </Box>
    </Box>
  );
}
