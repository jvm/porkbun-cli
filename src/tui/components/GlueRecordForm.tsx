import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { NormalizedGlueRecord } from '../types.js';

export interface GlueRecordFormProps {
  theme: any;
  mode: 'create' | 'edit';
  initialRecord?: NormalizedGlueRecord;
  onSubmit: (data: { hostname: string; ips: string[] }) => void;
  onCancel: () => void;
}

export function GlueRecordForm({ theme, mode, initialRecord, onSubmit, onCancel }: GlueRecordFormProps) {
  const [hostname, setHostname] = useState(initialRecord?.subdomain || '');
  const [ipsText, setIpsText] = useState(initialRecord?.ips.join(', ') || '');
  const [focusedField, setFocusedField] = useState(0);
  const isEdit = mode === 'edit';

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.tab) {
      setFocusedField((prev) => (prev + 1) % 2);
      return;
    }

    if (key.return) {
      const ips = ipsText.split(',').map((ip) => ip.trim()).filter(Boolean);
      if (hostname && ips.length > 0) {
        onSubmit({ hostname, ips });
      }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>{isEdit ? 'Edit' : 'Create'} Glue Record</Text>
      <Box marginTop={1}>
        <Text color={focusedField === 0 && !isEdit ? theme.colors.primary : undefined}>
          Hostname:{' '}
        </Text>
        {focusedField === 0 && !isEdit ? (
          <TextInput value={hostname} onChange={setHostname} />
        ) : (
          <Text>{hostname || '(root)'}</Text>
        )}
      </Box>
      <Box marginTop={1}>
        <Text color={(focusedField === 1 || isEdit) ? theme.colors.primary : undefined}>
          IPs (comma-separated):{' '}
        </Text>
        {focusedField === 1 || isEdit ? (
          <TextInput value={ipsText} onChange={setIpsText} />
        ) : (
          <Text>{ipsText}</Text>
        )}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Tab: switch fields | Enter: submit | Esc: cancel</Text>
      </Box>
    </Box>
  );
}
