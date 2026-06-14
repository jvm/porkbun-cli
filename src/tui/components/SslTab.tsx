import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { NormalizedSslBundle } from '../types.js';
import type { TuiApiService } from '../services/api.js';
import type { Theme } from '../theme.js';
import { SslExportForm } from './SslExportForm.js';

export interface SslTabProps {
  domain: string;
  service: TuiApiService;
  theme: Theme;
}

export function SslTab({ domain, service, theme }: SslTabProps) {
  const [sslBundle, setSslBundle] = useState<NormalizedSslBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportMode, setExportMode] = useState(false);

  const loadSsl = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await service.getSslBundle(domain);
      if (result.data) {
        setSslBundle(result.data);
      } else if (result.error) {
        setError(result.error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useInput((input) => {
    if (exportMode) return;
    if (input === 'r') {
      loadSsl();
    } else if (input === 'e' && sslBundle) {
      setExportMode(true);
    }
  });

  if (loading) {
    return (
      <Box padding={1}>
        <Text>Loading SSL bundle...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={theme.colors.danger}>Error: {error}</Text>
        <Text dimColor>Press 'r' to retry.</Text>
      </Box>
    );
  }

  if (!sslBundle) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>No SSL bundle loaded.</Text>
        <Text dimColor>Press 'r' to fetch SSL bundle for this domain.</Text>
      </Box>
    );
  }

  if (exportMode && sslBundle) {
    return (
      <SslExportForm
        theme={theme}
        domain={domain}
        sslBundle={sslBundle}
        onExport={() => {
          setExportMode(false);
          setSslBundle(null);
        }}
        onCancel={() => setExportMode(false)}
      />
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>SSL Bundle</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>Certificate Chain: {sslBundle.certificateChain ? '(available)' : '(not available)'}</Text>
        <Text>Public Key: {sslBundle.publicKey ? '(available)' : '(not available)'}</Text>
        <Text>Private Key: {sslBundle.privateKey ? '(available)' : '(not available)'}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press 'r' to refresh, 'e' to export.</Text>
      </Box>
    </Box>
  );
}
