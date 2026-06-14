import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { NormalizedDnssecRecord } from '../types.js';

export interface DnssecTabProps {
  records: NormalizedDnssecRecord[];
  theme: any;
  onCreate: () => void;
  onDelete: (record: NormalizedDnssecRecord) => void;
}

export function DnssecTab({ records, theme, onCreate, onDelete }: DnssecTabProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (input === 'n') {
      onCreate();
      return;
    }

    if (input === 'd' && records[selectedIndex]) {
      onDelete(records[selectedIndex]);
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(records.length - 1, prev + 1));
    }
  });

  if (records.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>No DNSSEC records found.</Text>
        <Text dimColor>Press 'n' to create a new DNSSEC record.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>DNSSEC Records</Text>
      <Box marginTop={1} flexDirection="column">
        {records.map((record, idx) => (
          <Box key={record.keyTag}>
            <Text color={idx === selectedIndex ? theme.colors.primary : undefined}>
              {idx === selectedIndex ? '▶ ' : '  '}
              Key Tag: {record.keyTag} | Alg: {record.alg} | Digest Type: {record.digestType}
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
