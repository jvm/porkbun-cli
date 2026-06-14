/**
 * Bulk operations screen - apply operations to multiple selected domains
 */
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { Theme } from "../theme.js";
import type { TuiApiService } from "../services/api.js";
import { VirtualList } from "./VirtualList.js";

export interface BulkOperationProps {
  theme: Theme;
  service: TuiApiService;
  domains: string[];
  operation: "auto-renew" | "nameservers" | "dns-record" | "url-forward";
  onComplete: () => void;
  onCancel: () => void;
}

type BulkStatus = "pending" | "running" | "success" | "failed" | "skipped";

interface BulkResult {
  domain: string;
  status: BulkStatus;
  error?: string;
  requestId?: string;
}

export function BulkOperation({
  theme,
  service,
  domains,
  operation,
  onComplete,
  onCancel,
}: BulkOperationProps) {
  const [results, setResults] = useState<BulkResult[]>(
    domains.map((d) => ({ domain: d, status: "pending" })),
  );
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [concurrency] = useState(3);

  const getOperationName = () => {
    switch (operation) {
      case "auto-renew":
        return "Enable Auto-Renew";
      case "nameservers":
        return "Update Nameservers";
      case "dns-record":
        return "Add DNS Record";
      case "url-forward":
        return "Add URL Forward";
    }
  };

  const executeOperation = async (
    domain: string,
  ): Promise<{ success: boolean; error?: string; requestId?: string }> => {
    try {
      switch (operation) {
        case "auto-renew": {
          const result = await service.updateAutoRenew(domain, "on");
          if (result.status === "error") {
            return { success: false, error: result.error?.message, requestId: result.requestId };
          }
          return { success: true };
        }
        // Other operations would be implemented similarly with their specific forms
        default:
          return { success: false, error: "Operation not yet implemented" };
      }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  };

  const startBulkOperation = async () => {
    setRunning(true);

    // Process in batches with concurrency limit
    const batches = [];
    for (let i = 0; i < results.length; i += concurrency) {
      batches.push(results.slice(i, i + concurrency));
    }

    for (const batch of batches) {
      const promises = batch.map(async (item) => {
        const resultIndex = results.findIndex((r) => r.domain === item.domain);

        // Update status to running
        setResults((prev) =>
          prev.map((r, i) => (i === resultIndex ? { ...r, status: "running" } : r)),
        );

        // Execute operation
        const result = await executeOperation(item.domain);

        // Update with result
        setResults((prev) =>
          prev.map((r, i) =>
            i === resultIndex
              ? {
                  ...r,
                  status: result.success ? "success" : "failed",
                  error: result.error,
                  requestId: result.requestId,
                }
              : r,
          ),
        );
      });

      await Promise.all(promises);
    }

    setRunning(false);
    setCompleted(true);
  };

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return && !running && !completed) {
      startBulkOperation();
      return;
    }

    if (key.return && completed) {
      onComplete();
      return;
    }
  });

  const successCount = results.filter((r) => r.status === "success").length;
  const failedCount = results.filter((r) => r.status === "failed").length;
  // pendingCount reserved for a future "X remaining" footer
  const pendingCount = results.filter((r) => r.status === "pending").length;
  void pendingCount;

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color={theme.colors.warning}>
        ⚠ Bulk Operation: {getOperationName()}
      </Text>
      <Box marginTop={1}>
        <Text>Domains: {domains.length}</Text>
      </Box>
      <Box marginTop={1}>
        <Text>
          {completed ? (
            <>
              <Text color={theme.colors.success}>✓ {successCount} succeeded</Text>
              {failedCount > 0 && <Text> | </Text>}
              {failedCount > 0 && <Text color={theme.colors.danger}>✗ {failedCount} failed</Text>}
            </>
          ) : running ? (
            <Text>
              Processing... ({successCount + failedCount}/{domains.length})
            </Text>
          ) : (
            <Text dimColor>Press Enter to start, Esc to cancel</Text>
          )}
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column" borderStyle="single" borderColor="gray" padding={1}>
        <VirtualList
          items={results}
          selectedIndex={0}
          maxVisible={15}
          theme={theme}
          renderItem={(result) => (
            <Box>
              <Text>
                {result.status === "success" && <Text color={theme.colors.success}>✓</Text>}
                {result.status === "failed" && <Text color={theme.colors.danger}>✗</Text>}
                {result.status === "running" && <Text color={theme.colors.warning}>⟳</Text>}
                {result.status === "pending" && <Text dimColor>○</Text>} {result.domain}
                {result.error && <Text color={theme.colors.danger}> - {result.error}</Text>}
              </Text>
            </Box>
          )}
        />
      </Box>

      {completed && (
        <Box marginTop={1}>
          <Text dimColor>Press Enter to continue</Text>
        </Box>
      )}
    </Box>
  );
}
