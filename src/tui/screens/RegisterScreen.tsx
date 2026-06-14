/**
 * RegisterScreen - domain registration with availability check and billable confirmation
 */
import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import type { Theme } from '../theme.js';
import type { TuiApiService } from '../services/api.js';
import { RegisterForm } from '../components/RegisterForm.js';

interface RegisterScreenProps {
  service: TuiApiService;
  theme: Theme;
  balanceCents?: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function RegisterScreen({ service, theme, onSuccess, onCancel }: RegisterScreenProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRegister = useCallback(async (domain: string, cost: number) => {
    setError(null);
    setSuccess(null);
    
    try {
      // For registration, we need to pass "yes" as the agreeToTerms value
      const result = await service.registerDomain(domain, cost, 'yes');
      
      if (result.status === 'loaded') {
        setSuccess(`Successfully registered ${domain}!`);
        setTimeout(() => {
          onSuccess();
        }, 2000);
      } else if (result.error) {
        setError(result.error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [service, onSuccess]);

  return (
    <Box flexDirection="column" flexGrow={1}>
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
      <RegisterForm
        theme={theme}
        service={service}
        onRegister={handleRegister}
        onCancel={onCancel}
      />
    </Box>
  );
}
