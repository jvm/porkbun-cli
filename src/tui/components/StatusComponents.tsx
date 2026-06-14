/**
 * Status, loading, empty, and error state components.
 */
import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { Theme } from "../theme.js";

interface LoadingStateProps {
  message: string;
  theme: Theme;
}

export function LoadingState({ message }: LoadingStateProps) {
  return (
    <Box padding={1}>
      <Spinner type="dots" />
      <Text> {message}</Text>
    </Box>
  );
}

interface EmptyStateProps {
  message: string;
  details?: string;
  theme: Theme;
}

export function EmptyState({ message, details }: EmptyStateProps) {
  return (
    <Box flexDirection="column" padding={1}>
      <Text dimColor>{message}</Text>
      {details && <Text dimColor>{details}</Text>}
    </Box>
  );
}

interface ErrorStateProps {
  error: Error;
  retryable?: boolean;
  onRetry?: () => void;
  theme: Theme;
}

export function ErrorState({ error, retryable, onRetry, theme }: ErrorStateProps) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="red" padding={1}>
      <Text color="red" bold>
        {theme.icons.cross} Error
      </Text>
      <Text>{error.message}</Text>
      {retryable && onRetry && <Text dimColor>Press r to retry.</Text>}
    </Box>
  );
}

interface StaleBannerProps {
  theme: Theme;
}

export function StaleBanner({ theme }: StaleBannerProps) {
  return (
    <Box borderStyle="single" borderColor="yellow" padding={0}>
      <Text color="yellow">{theme.icons.stale} Data may be stale. Press r to refresh.</Text>
    </Box>
  );
}

interface StatusLineProps {
  message?: string;
  selection?: { count: number; extendsBeyondLoaded?: boolean };
  loading?: boolean;
  theme: Theme;
}

export function StatusLine({ message, selection, loading, theme }: StatusLineProps) {
  return (
    <Box justifyContent="space-between" width="100%">
      <Box>
        {loading && <Spinner type="dots" />}
        {message && <Text> {message}</Text>}
      </Box>
      <Box>
        {selection && selection.count > 0 && (
          <Text color={theme.colors.info}>
            {selection.count} selected
            {selection.extendsBeyondLoaded && " (beyond loaded)"}
          </Text>
        )}
      </Box>
    </Box>
  );
}

interface KeyHelpProps {
  bindings: Array<{ key: string; label: string; description: string }>;
  theme: Theme;
}

export function KeyHelp({ bindings, theme }: KeyHelpProps) {
  return (
    <Box flexWrap="wrap">
      {bindings.map((binding, i) => (
        <Box key={i} marginRight={2}>
          <Text bold color={theme.colors.primary}>
            {binding.label}
          </Text>
          <Text dimColor> {binding.description}</Text>
        </Box>
      ))}
    </Box>
  );
}
