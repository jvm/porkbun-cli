import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { TuiApiService } from '../services/api.js';
import type { Theme } from '../theme.js';
import { priceStringToCents } from '../forms/validators.js';

export interface RegisterFormProps {
  theme: Theme;
  service: TuiApiService;
  onRegister: (domain: string, cost: number) => Promise<void>;
  onCancel: () => void;
}

interface AvailabilityResult {
  available: boolean;
  cost?: number;
  reason?: string;
}

export function RegisterForm({ theme, service, onRegister, onCancel }: RegisterFormProps) {
  const [domain, setDomain] = useState('');
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readyToSubmit, setReadyToSubmit] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');

  const checkAvailability = async () => {
    if (!domain || !domain.includes('.')) {
      setError('Please enter a valid domain name (e.g., example.com)');
      return;
    }

    setChecking(true);
    setError(null);
    setAvailability(null);

    try {
      const result = await service.checkDomain(domain);
      if (result.status === 'loaded' && result.data) {
        const response = result.data.response as {
          avail?: string;
          price?: string;
          reason?: string;
        };
        // Porkbun returns availability as `avail` ('yes'/'no') and the
        // registration price as a top-level `price` string. Renewal and
        // transfer prices are not in the checkDomain response; look them
        // up from the pricing endpoint when needed.
        const available = response?.avail === 'yes';
        const priceStr: string | undefined = response?.price;

        let costCents: number | undefined;
        if (priceStr) {
          const parsed = priceStringToCents(priceStr);
          if (parsed !== undefined) costCents = parsed;
        }

        if (costCents === undefined) {
          const tld = domain.split('.').slice(-1)[0];
          if (tld) {
            const tldPrice = await service.getTldPrice(tld, 'registration');
            if (tldPrice) {
              const parsed = priceStringToCents(tldPrice);
              if (parsed !== undefined) costCents = parsed;
            }
          }
        }

        setAvailability({
          available,
          cost: costCents,
          reason: !available ? response?.reason || 'Domain not available' : undefined,
        });

        if (available && costCents !== undefined) {
          setReadyToSubmit(true);
        }
      } else if (result.error) {
        setError(result.error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
    }
  };

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (!readyToSubmit) {
      if (key.return && !checking && domain) {
        checkAvailability();
      }
    } else {
      if (key.return && confirmationText === domain) {
        if (availability?.cost) {
          onRegister(domain, availability.cost);
        }
      }
    }
  });

  if (!readyToSubmit) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Register Domain</Text>
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text>Domain: </Text>
            {checking ? (
              <Text dimColor>Checking availability...</Text>
            ) : (
              <TextInput value={domain} onChange={setDomain} placeholder="example.com" />
            )}
          </Box>
          {error && (
            <Box marginTop={1}>
              <Text color={theme.colors.danger}>{error}</Text>
            </Box>
          )}
          {availability && !availability.available && (
            <Box marginTop={1}>
              <Text color={theme.colors.warning}>{availability.reason}</Text>
            </Box>
          )}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Enter: Check availability | Esc: Cancel</Text>
        </Box>
      </Box>
    );
  }

  // Confirmation screen
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color={theme.colors.danger}>⚠ Billable Operation: Register Domain</Text>
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text>Domain: </Text>
          <Text bold>{domain}</Text>
        </Box>
        <Box>
          <Text>Cost: </Text>
          <Text bold color={theme.colors.danger}>${availability?.cost ? (availability.cost / 100).toFixed(2) : '?'}</Text>
          <Text dimColor> (charged to account balance)</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text bold>This action will:</Text>
          <Text>• Register the domain for 1 year</Text>
          <Text>• Charge your account balance immediately</Text>
          <Text>• Be irreversible after completion</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text bold color={theme.colors.warning}>To confirm, type the domain name exactly:</Text>
          <Box>
            <Text>Type: </Text>
            <TextInput value={confirmationText} onChange={setConfirmationText} />
          </Box>
          {confirmationText && confirmationText !== domain && (
            <Text color={theme.colors.danger}>Does not match! Type: {domain}</Text>
          )}
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Enter: Register | Esc: Cancel</Text>
      </Box>
    </Box>
  );
}
