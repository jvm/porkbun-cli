/**
 * TransfersScreen - domain transfer initiation with pricing check and billable confirmation
 */
import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Theme } from '../theme.js';
import type { TuiApiService } from '../services/api.js';
import type { NormalizedTransfer } from '../types.js';
import { TransferForm } from '../components/TransferForm.js';
import { VirtualList } from '../components/VirtualList.js';

interface TransfersScreenProps {
  service: TuiApiService;
  theme: Theme;
  balanceCents?: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TransfersScreen({ service, theme, balanceCents, onSuccess, onCancel }: TransfersScreenProps) {
  const [transfers, setTransfers] = useState<NormalizedTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const loadTransfers = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await service.listTransfers();
      if (result.status === 'loaded' && result.data) {
        setTransfers(result.data);
      } else if (result.error) {
        setError(result.error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  const handleTransfer = useCallback(async (domain: string, cost: number, authCode: string) => {
    setError(null);
    setSuccess(null);
    
    try {
      const result = await service.transferDomain(domain, cost, authCode);
      
      if (result.status === 'loaded') {
        setSuccess(`Successfully initiated transfer for ${domain}!`);
        setShowForm(false);
        // Refresh transfers list
        await loadTransfers();
        setTimeout(() => {
          onSuccess();
        }, 2000);
      } else if (result.error) {
        setError(result.error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [service, onSuccess, loadTransfers]);

  useInput((char, key) => {
    if (showForm) return;
    
    if (key.escape || char === 'q') {
      onCancel();
    } else if (char === 'n') {
      setShowForm(true);
    } else if (char === 'r') {
      loadTransfers();
    } else if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(prev => prev - 1);
    } else if (key.downArrow && selectedIndex < transfers.length - 1) {
      setSelectedIndex(prev => prev + 1);
    }
  });

  if (loading) {
    return (
      <Box padding={1}>
        <Text dimColor>Loading transfers...</Text>
      </Box>
    );
  }

  if (showForm) {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <TransferForm
          theme={theme}
          service={service}
          balanceCents={balanceCents}
          onTransfer={handleTransfer}
          onCancel={() => setShowForm(false)}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.colors.primary}>Domain Transfers</Text>
      </Box>

      {error && (
        <Box marginTop={1} marginBottom={1}>
          <Text color={theme.colors.danger}>❌ {error}</Text>
        </Box>
      )}
      {success && (
        <Box marginTop={1} marginBottom={1}>
          <Text color={theme.colors.success}>✅ {success}</Text>
        </Box>
      )}

      {transfers.length === 0 ? (
        <Box flexDirection="column" padding={1}>
          <Text dimColor>No active transfers</Text>
          <Box marginTop={1}>
            <Text dimColor>Press 'n' to initiate a new transfer</Text>
          </Box>
        </Box>
      ) : (
        <>
          <VirtualList
            items={transfers}
            selectedIndex={selectedIndex}
            maxVisible={20}
            theme={theme}
            renderItem={(transfer, index, isSelected) => (
              <Box>
                <Text
                  backgroundColor={isSelected ? theme.colors.selectedBg : undefined}
                  color={isSelected ? theme.colors.selected : undefined}
                >
                  {isSelected ? '▸ ' : '  '}
                  {transfer.domain.padEnd(30)}
                  {transfer.status.padEnd(15)}
                  {transfer.transferDate || 'Pending'}
                </Text>
              </Box>
            )}
          />
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>n: Initiate new transfer | r: Refresh | Esc/q: Back</Text>
          </Box>
        </>
      )}
    </Box>
  );
}
