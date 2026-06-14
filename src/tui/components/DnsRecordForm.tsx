import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { Theme } from "../theme.js";
import type { NormalizedDnsRecord } from "../types.js";
import { buildDnsRecordPayload, stripParentDomain } from "../forms/validators.js";

interface DnsRecordFormProps {
  theme: Theme;
  domain: string;
  initialRecord?: NormalizedDnsRecord;
  onSubmit: (record: Partial<NormalizedDnsRecord>) => void;
  onCancel: () => void;
  mode: "create" | "edit";
}

export function DnsRecordForm({
  theme,
  domain,
  initialRecord,
  onSubmit,
  onCancel,
  mode,
}: DnsRecordFormProps) {
  const [type, setType] = useState(initialRecord?.type || "");
  const [name, setName] = useState(
    initialRecord ? stripParentDomain(initialRecord.name, domain) : "",
  );
  const [content, setContent] = useState(initialRecord?.content || "");
  const [ttl, setTtl] = useState(initialRecord?.ttl?.toString() || "300");
  const [prio, setPrio] = useState(initialRecord?.prio?.toString() || "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fields = [
    { label: "Type", value: type, onChange: setType, required: true },
    { label: "Name", value: name, onChange: setName, required: false },
    { label: "Content", value: content, onChange: setContent, required: true },
    { label: "TTL", value: ttl, onChange: setTtl, required: false },
    { label: "Priority", value: prio, onChange: setPrio, required: false },
  ];

  const [focusedField, setFocusedField] = useState(0);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.tab || key.downArrow) {
      setFocusedField((prev) => (prev + 1) % fields.length);
      return;
    }

    if (key.upArrow) {
      setFocusedField((prev) => (prev - 1 + fields.length) % fields.length);
      return;
    }

    if (key.return) {
      // Validate
      const newErrors: Record<string, string> = {};
      fields.forEach((field) => {
        if (field.required && !field.value.trim()) {
          newErrors[field.label] = `${field.label} is required`;
        }
      });

      if (
        type &&
        !["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "NS", "CAA", "TLSA", "SSHFP"].includes(
          type.toUpperCase(),
        )
      ) {
        newErrors.Type = "Invalid record type";
      }

      if (ttl && isNaN(Number(ttl))) {
        newErrors.TTL = "TTL must be a number";
      }

      if (prio && isNaN(Number(prio))) {
        newErrors.Priority = "Priority must be a number";
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      // Submit: the write API expects the subdomain label, or empty for the
      // apex record. The payload builder strips the parent domain and omits
      // 'name' entirely when the apex is selected.
      const record = buildDnsRecordPayload(
        { type, name, content, ttl, prio, notes: "" },
        domain,
      ) as Partial<NormalizedDnsRecord>;
      onSubmit(record);
    }
  });

  return (
    <Box flexDirection="column" width="100%">
      <Box marginBottom={1}>
        <Text bold color={theme.colors.primary}>
          {mode === "create" ? "Create DNS Record" : "Edit DNS Record"}
        </Text>
      </Box>

      {fields.map((field, idx) => (
        <Box key={field.label} flexDirection="column" marginBottom={1}>
          <Box>
            <Text color={idx === focusedField ? theme.colors.primary : undefined}>
              {idx === focusedField ? "▶ " : "  "}
              {field.label}
              {field.required && "*"}:{" "}
            </Text>
            <TextInput
              value={field.value}
              onChange={field.onChange}
              placeholder={field.label}
              focus={idx === focusedField}
            />
          </Box>
          {errors[field.label] && (
            <Box marginLeft={2}>
              <Text color={theme.colors.danger}>{errors[field.label]}</Text>
            </Box>
          )}
        </Box>
      ))}

      <Box marginTop={1}>
        <Text dimColor>Tab/↑↓: Navigate | Enter: Submit | Esc: Cancel</Text>
      </Box>
    </Box>
  );
}
