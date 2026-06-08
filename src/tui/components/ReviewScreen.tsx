/**
 * ReviewScreen - shows normalized request data before confirmation.
 * ResultScreen - shows operation result.
 * ConfirmModal - confirmation dialog.
 */
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { ReviewSnapshot, OperationResult } from '../types.js';
import type { Theme } from '../theme.js';

interface ReviewScreenProps {
  review: ReviewSnapshot;
  confirmationText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onEdit?: () => void;
  theme: Theme;
}

export function ReviewScreen({ review, confirmationText, onConfirm, onCancel, onEdit, theme }: ReviewScreenProps) {
  const [input, setInput] = useState('');
  const needsConfirmation = confirmationText !== undefined;
  const canConfirm = !needsConfirmation || input === confirmationText;

  useInput((char, key) => {
    if (key.escape) {
      onCancel();
    } else if (key.return && canConfirm) {
      onConfirm();
    } else if (char === 'e' && onEdit) {
      onEdit();
    } else if (needsConfirmation && !key.ctrl && !key.meta) {
      if (key.backspace || key.delete) {
        setInput(prev => prev.slice(0, -1));
      } else if (char) {
        setInput(prev => prev + char);
      }
    }
  });

  return (
    <Box flexDirection="column" borderStyle="double" borderColor={theme.colors.warning} padding={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.colors.warning}>
          {review.classification === 'billable' && theme.icons.billable}
          {review.classification === 'destructive' && theme.icons.destructive}
          {' '}
          Review: {review.operation}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>Target: </Text>
        <Text bold>{review.target}</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        {review.fields.map((field, i) => (
          <Box key={i}>
            <Text dimColor>{field.label}: </Text>
            <Text color={field.sensitive ? theme.colors.warning : undefined}>
              {field.sensitive ? '[REDACTED]' : field.value}
            </Text>
          </Box>
        ))}
      </Box>

      {review.idempotencyKey && (
        <Box marginBottom={1}>
          <Text dimColor>Idempotency key: {review.idempotencyKey}</Text>
        </Box>
      )}

      {needsConfirmation && (
        <Box flexDirection="column" marginBottom={1}>
          <Text>
            Type <Text bold color={theme.colors.warning}>{confirmationText}</Text> to confirm:
          </Text>
          <Box marginTop={1}>
            <Text color={input === confirmationText ? theme.colors.success : theme.colors.warning}>
              {input || '_'}
            </Text>
          </Box>
        </Box>
      )}

      <Box>
        <Text dimColor>
          {canConfirm ? '[Enter] Confirm' : '[Type confirmation]'}
          {onEdit && ' | [e] Edit'}
          {' | [Esc] Cancel'}
        </Text>
      </Box>
    </Box>
  );
}

interface ResultScreenProps {
  result: OperationResult;
  onClose: () => void;
  theme: Theme;
}

export function ResultScreen({ result, onClose, theme }: ResultScreenProps) {
  useInput((char, key) => {
    if (key.return || key.escape || char === 'q') {
      onClose();
    }
  });

  return (
    <Box flexDirection="column" borderStyle="double" borderColor={result.success ? theme.colors.success : theme.colors.danger} padding={1}>
      <Box marginBottom={1}>
        <Text bold color={result.success ? theme.colors.success : theme.colors.danger}>
          {result.success ? theme.icons.check : theme.icons.cross}
          {' '}
          {result.success ? 'Success' : 'Failed'}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>{result.message}</Text>
      </Box>

      {result.requestId && (
        <Box marginBottom={1}>
          <Text dimColor>Request ID: {result.requestId}</Text>
        </Box>
      )}

      {result.error && (
        <Box marginBottom={1}>
          <Text color={theme.colors.danger}>{result.error.message}</Text>
        </Box>
      )}

      <Box>
        <Text dimColor>[Enter/Esc/q] Close</Text>
      </Box>
    </Box>
  );
}

interface ConfirmModalProps {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  theme: Theme;
}

export function ConfirmModal({ message, confirmLabel = 'Confirm', onConfirm, onCancel, theme }: ConfirmModalProps) {
  useInput((char, key) => {
    if (key.escape) {
      onCancel();
    } else if (char === 'y' || char === 'Y' || key.return) {
      onConfirm();
    } else if (char === 'n' || char === 'N') {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column" borderStyle="double" borderColor={theme.colors.warning} padding={1}>
      <Box marginBottom={1}>
        <Text bold>{message}</Text>
      </Box>
      <Box>
        <Text dimColor>
          [y/Enter] {confirmLabel} | [n/Esc] Cancel
        </Text>
      </Box>
    </Box>
  );
}
