import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { NormalizedTransfer } from "../types.js";
import type { TuiApiService } from "../services/api.js";
import type { Theme } from "../theme.js";

export interface TransferTabProps {
  domain: string;
  service: TuiApiService;
  theme: Theme;
}

export function TransferTab({ domain, service, theme }: TransferTabProps) {
  const [transfer, setTransfer] = useState<NormalizedTransfer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTransfer = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await service.getTransfer(domain);
      if (result.data) {
        const data = result.data as {
          domain?: unknown;
          status?: unknown;
          statusDescription?: unknown;
          transferDate?: unknown;
          orderId?: unknown;
        };
        setTransfer({
          domain: String(data.domain || ""),
          status: String(data.status || ""),
          statusDescription: data.statusDescription ? String(data.statusDescription) : undefined,
          transferDate: data.transferDate ? String(data.transferDate) : undefined,
          orderId: data.orderId ? String(data.orderId) : undefined,
          raw: result.data,
        });
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
    if (input === "r") {
      loadTransfer();
    }
  });

  if (loading) {
    return (
      <Box padding={1}>
        <Text>Loading transfer status...</Text>
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

  if (!transfer) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>No transfer information available.</Text>
        <Text dimColor>Press 'r' to check transfer status for this domain.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Transfer Status</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>Domain: {transfer.domain}</Text>
        <Text>Status: {transfer.status}</Text>
        <Text>Description: {transfer.statusDescription || "(none)"}</Text>
        {transfer.transferDate && <Text>Transfer Date: {transfer.transferDate}</Text>}
        {transfer.orderId && <Text>Order ID: {transfer.orderId}</Text>}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press 'r' to refresh.</Text>
      </Box>
    </Box>
  );
}
