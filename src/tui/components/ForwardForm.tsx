import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

export interface ForwardFormProps {
  theme: any;
  onSubmit: (data: { subdomain: string; location: string; type: string; includePath: string; wildcard: string }) => void;
  onCancel: () => void;
}

export function ForwardForm({ theme, onSubmit, onCancel }: ForwardFormProps) {
  const [subdomain, setSubdomain] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('temporary');
  const [includePath, setIncludePath] = useState('no');
  const [wildcard, setWildcard] = useState('no');
  const [focusedField, setFocusedField] = useState(0);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.tab) {
      setFocusedField((prev) => (prev + 1) % 5);
      return;
    }

    if (key.return) {
      if (location) {
        onSubmit({ subdomain, location, type, includePath, wildcard });
      }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Create URL Forward</Text>
      <Box marginTop={1}>
        <Text color={focusedField === 0 ? theme.colors.primary : undefined}>
          Subdomain:{' '}
        </Text>
        {focusedField === 0 ? (
          <TextInput value={subdomain} onChange={setSubdomain} />
        ) : (
          <Text>{subdomain || '(empty)'}</Text>
        )}
      </Box>
      <Box marginTop={1}>
        <Text color={focusedField === 1 ? theme.colors.primary : undefined}>
          Location:{' '}
        </Text>
        {focusedField === 1 ? (
          <TextInput value={location} onChange={setLocation} />
        ) : (
          <Text>{location}</Text>
        )}
      </Box>
      <Box marginTop={1}>
        <Text color={focusedField === 2 ? theme.colors.primary : undefined}>
          Type:{' '}
        </Text>
        {focusedField === 2 ? (
          <TextInput value={type} onChange={setType} />
        ) : (
          <Text>{type}</Text>
        )}
      </Box>
      <Box marginTop={1}>
        <Text color={focusedField === 3 ? theme.colors.primary : undefined}>
          Include Path:{' '}
        </Text>
        {focusedField === 3 ? (
          <TextInput value={includePath} onChange={setIncludePath} />
        ) : (
          <Text>{includePath}</Text>
        )}
      </Box>
      <Box marginTop={1}>
        <Text color={focusedField === 4 ? theme.colors.primary : undefined}>
          Wildcard:{' '}
        </Text>
        {focusedField === 4 ? (
          <TextInput value={wildcard} onChange={setWildcard} />
        ) : (
          <Text>{wildcard}</Text>
        )}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Tab: switch fields | Enter: submit | Esc: cancel</Text>
      </Box>
    </Box>
  );
}
