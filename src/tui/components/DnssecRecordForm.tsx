import React, { useState } from "react";
import { Box, useInput } from "ink";
import { Text } from "../text.js";
import TextInput from "ink-text-input";
import type { Theme } from "../theme.js";

export interface DnssecRecordFormProps {
  theme: Theme;
  initialValues?:
    | {
        keyTag?: string | undefined;
        alg?: string | undefined;
        digestType?: string | undefined;
        digest?: string | undefined;
      }
    | undefined;
  onSubmit: (data: { keyTag: number; alg: number; digestType: number; digest: string }) => void;
  onCancel: () => void;
}

export function DnssecRecordForm({
  theme,
  initialValues,
  onSubmit,
  onCancel,
}: DnssecRecordFormProps) {
  const [keyTag, setKeyTag] = useState(initialValues?.keyTag ?? "");
  const [alg, setAlg] = useState(initialValues?.alg ?? "");
  const [digestType, setDigestType] = useState(initialValues?.digestType ?? "");
  const [digest, setDigest] = useState(initialValues?.digest ?? "");
  const [focusedField, setFocusedField] = useState(0);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.tab) {
      setFocusedField((prev) => (prev + 1) % 4);
      return;
    }

    if (key.return) {
      const keyTagNum = parseInt(keyTag, 10);
      const algNum = parseInt(alg, 10);
      const digestTypeNum = parseInt(digestType, 10);
      if (!isNaN(keyTagNum) && !isNaN(algNum) && !isNaN(digestTypeNum) && digest) {
        onSubmit({ keyTag: keyTagNum, alg: algNum, digestType: digestTypeNum, digest });
      }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Create DNSSEC Record</Text>
      <Box marginTop={1}>
        <Text color={focusedField === 0 ? theme.colors.primary : undefined}>Key Tag: </Text>
        {focusedField === 0 ? (
          <TextInput value={keyTag} onChange={setKeyTag} />
        ) : (
          <Text>{keyTag}</Text>
        )}
      </Box>
      <Box marginTop={1}>
        <Text color={focusedField === 1 ? theme.colors.primary : undefined}>Algorithm: </Text>
        {focusedField === 1 ? <TextInput value={alg} onChange={setAlg} /> : <Text>{alg}</Text>}
      </Box>
      <Box marginTop={1}>
        <Text color={focusedField === 2 ? theme.colors.primary : undefined}>Digest Type: </Text>
        {focusedField === 2 ? (
          <TextInput value={digestType} onChange={setDigestType} />
        ) : (
          <Text>{digestType}</Text>
        )}
      </Box>
      <Box marginTop={1}>
        <Text color={focusedField === 3 ? theme.colors.primary : undefined}>Digest: </Text>
        {focusedField === 3 ? (
          <TextInput value={digest} onChange={setDigest} />
        ) : (
          <Text>{digest}</Text>
        )}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Tab: switch fields | Enter: submit | Esc: cancel</Text>
      </Box>
    </Box>
  );
}
