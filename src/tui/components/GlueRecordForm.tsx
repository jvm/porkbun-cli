import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { NormalizedGlueRecord } from "../types.js";
import type { Theme } from "../theme.js";

export interface GlueRecordFormProps {
  theme: Theme;
  mode: "create" | "edit";
  initialRecord?: NormalizedGlueRecord;
  // When the user returns to the form from the confirmation step ('b'),
  // re-seed it from these values so the in-progress edits are not lost.
  initialValues?: { hostname?: string; ips?: string[] };
  onSubmit: (data: { hostname: string; ips: string[] }) => void;
  onCancel: () => void;
}

export function GlueRecordForm({
  theme,
  mode,
  initialRecord,
  initialValues,
  onSubmit,
  onCancel,
}: GlueRecordFormProps) {
  const seedHostname = initialValues?.hostname ?? initialRecord?.subdomain ?? "";
  const seedIpsText = initialValues?.ips?.join(", ") ?? initialRecord?.ips.join(", ") ?? "";
  const [hostname, setHostname] = useState(seedHostname);
  const [ipsText, setIpsText] = useState(seedIpsText);
  const [focusedField, setFocusedField] = useState(0);
  const isEdit = mode === "edit";

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.tab) {
      setFocusedField((prev) => (prev + 1) % 2);
      return;
    }

    if (key.return) {
      const ips = ipsText
        .split(",")
        .map((ip) => ip.trim())
        .filter(Boolean);
      if (hostname && ips.length > 0) {
        onSubmit({ hostname, ips });
      }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>{isEdit ? "Edit" : "Create"} Glue Record</Text>
      <Box marginTop={1}>
        <Text color={focusedField === 0 && !isEdit ? theme.colors.primary : undefined}>
          Hostname:{" "}
        </Text>
        {focusedField === 0 && !isEdit ? (
          <TextInput value={hostname} onChange={setHostname} />
        ) : (
          <Text>{hostname || "(root)"}</Text>
        )}
      </Box>
      <Box marginTop={1}>
        <Text color={focusedField === 1 || isEdit ? theme.colors.primary : undefined}>
          IPs (comma-separated):{" "}
        </Text>
        {focusedField === 1 || isEdit ? (
          <TextInput value={ipsText} onChange={setIpsText} />
        ) : (
          <Text>{ipsText}</Text>
        )}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Tab: switch fields | Enter: submit | Esc: cancel</Text>
      </Box>
    </Box>
  );
}
