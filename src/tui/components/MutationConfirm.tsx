/**
 * MutationConfirm - confirmation component for mutations
 * Shows the review snapshot and handles confirmation input
 */
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { Theme } from '../theme.js';
import type { ReviewSnapshot, ConfirmationLevel } from '../types.js';

interface MutationConfirmProps {
  theme: Theme;
  review: ReviewSnapshot;
  confirmationLevel: ConfirmationLevel;
  onConfirm: () => void;
  onBack: () => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function MutationConfirm({
  theme,
  review,
  confirmationLevel,
  onConfirm,
  onBack,
  onCancel,
  submitting = false,
}: MutationConfirmProps) {
  const [confirmInput, setConfirmInput] = useState('');
  const [error] = useState<string | null>(null);

  const requiresTextConfirmation =
    confirmationLevel === 'billable' ||
    confirmationLevel === 'bulk-disruptive';

  const expectedText =
    confirmationLevel === 'billable'
      ? review.target
      : confirmationLevel === 'bulk-disruptive'
      ? review.fields.find(f => f.label === 'Domain count')?.value || ''
      : '';

  const canConfirm = !requiresTextConfirmation || confirmInput === expectedText;

  useInput((input, key) => {
    if (submitting) return;

    if (key.escape) {
      onCancel();
      return;
    }

    if (input === 'b' || input === 'B') {
      onBack();
      return;
    }

    if (key.return && canConfirm) {
      onConfirm();
      return;
    }
  });

  return (
    <Box flexDirection="column" width="100%" padding={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.colors.primary}>
          Confirm {review.operation}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>Domain: </Text>
        <Text bold>{review.target}</Text>
      </Box>

      <Box marginBottom={1}>
        <Text>Operation: </Text>
        <Text>{review.operation}</Text>
      </Box>

      <Box marginBottom={1}>
        <Text>Classification: </Text>
        <Text color={
          review.classification === 'billable' ? theme.colors.danger :
          review.classification === 'destructive' ? theme.colors.danger :
          review.classification === 'mutating' ? theme.colors.warning :
          theme.colors.info
        }>
          {review.classification.toUpperCase()}
        </Text>
      </Box>

      {review.fields.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>Details:</Text>
          {review.fields.map((field, idx) => (
            <Box key={idx} marginLeft={2}>
              <Text>{field.label}: </Text>
              <Text color={field.sensitive ? theme.colors.muted : undefined}>
                {field.sensitive ? '••••••' : field.value}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {review.idempotencyKey && (
        <Box marginBottom={1}>
          <Text dimColor>Idempotency Key: {review.idempotencyKey}</Text>
        </Box>
      )}

      {requiresTextConfirmation && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={theme.colors.warning}>
            Type "{expectedText}" to confirm:
          </Text>
          <Box marginTop={1}>
            <TextInput
              value={confirmInput}
              onChange={setConfirmInput}
              placeholder={expectedText}
            />
          </Box>
          {error && (
            <Box marginTop={1}>
              <Text color={theme.colors.danger}>{error}</Text>
            </Box>
          )}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          {submitting
            ? 'Submitting...'
            : `[Enter] Confirm | [b] Back to edit | [Esc] Cancel`}
        </Text>
      </Box>
    </Box>
  );
}
