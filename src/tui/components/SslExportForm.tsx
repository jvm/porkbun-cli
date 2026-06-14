/**
 * SSL export form - secure export of SSL certificate bundles
 */
import React, { useState } from "react";
import { Box, useInput } from "ink";
import { Text } from "../text.js";
import TextInput from "ink-text-input";
import { join } from "node:path";
import { chmod, mkdir, writeFile } from "../../lib/safe-io.js";
import type { Theme } from "../theme.js";
import type { NormalizedSslBundle } from "../types.js";

export interface SslExportFormProps {
  theme: Theme;
  domain: string;
  sslBundle: NormalizedSslBundle;
  onExport: () => void;
  onCancel: () => void;
}

export function SslExportForm({
  theme,
  domain,
  sslBundle,
  onExport,
  onCancel,
}: SslExportFormProps) {
  const [exportPath, setExportPath] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setExporting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const doExport = async () => {
    if (!exportPath) {
      setError("Export path is required");
      return;
    }

    setExporting(true);
    setError(null);

    try {
      // The export path is typed in by the operator running this export
      // (the SSL bundle's owner). File modes 0700 / 0600 below are the
      // real security boundary; path validation would just be friction
      // for the legitimate use case.
      await mkdir(exportPath, { recursive: true, mode: 0o700 });
      await chmod(exportPath, 0o700);

      const certPath = join(exportPath, `${domain}.certificate-chain.pem`);
      const keyPath = join(exportPath, `${domain}.private-key.pem`);
      const pubPath = join(exportPath, `${domain}.public-key.pem`);

      const writeMode = overwrite ? "w" : "wx";

      // Write files with secure permissions. When overwrite=false,
      // `wx` makes the create operation atomic and avoids check-then-act races.
      if (sslBundle.certificateChain) {
        await writeFile(certPath, sslBundle.certificateChain, { mode: 0o644, flag: writeMode });
      }

      if (sslBundle.privateKey) {
        await writeFile(keyPath, sslBundle.privateKey, { mode: 0o600, flag: writeMode });
        // writeFile's mode option is only honored on create; re-apply for overwrites.
        await chmod(keyPath, 0o600);
      }

      if (sslBundle.publicKey) {
        await writeFile(pubPath, sslBundle.publicKey, { mode: 0o644, flag: writeMode });
      }

      setSuccess(`Exported SSL bundle to ${exportPath}`);
      setTimeout(() => {
        onExport();
      }, 2000);
    } catch (err) {
      if (err instanceof Error && "code" in err && err.code === "EEXIST" && !overwrite) {
        setError("Files already exist. Press Enter to overwrite or Esc to cancel.");
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
      setExporting(false);
    }
  };

  useInput((input, key) => {
    if (key.escape) {
      if (error && error.includes("already exist")) {
        onCancel();
      } else {
        onCancel();
      }
      return;
    }

    if (key.return) {
      if (error && error.includes("already exist")) {
        setOverwrite(true);
        doExport();
      } else {
        doExport();
      }
    }
  });

  if (success) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color={theme.colors.success}>
          ✓ {success}
        </Text>
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Files exported:</Text>
          {sslBundle.certificateChain && (
            <Text dimColor> - {domain}.certificate-chain.pem (0644)</Text>
          )}
          {sslBundle.privateKey && <Text dimColor> - {domain}.private-key.pem (0600)</Text>}
          {sslBundle.publicKey && <Text dimColor> - {domain}.public-key.pem (0644)</Text>}
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Export SSL Bundle for {domain}</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>Export directory:</Text>
        <TextInput value={exportPath} onChange={setExportPath} placeholder="/path/to/export" />
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text bold>Files to export:</Text>
        {sslBundle.certificateChain && <Text dimColor> ✓ {domain}.certificate-chain.pem</Text>}
        {sslBundle.privateKey && (
          <Text color={theme.colors.warning} dimColor>
            {" "}
            ✓ {domain}.private-key.pem (0600)
          </Text>
        )}
        {sslBundle.publicKey && <Text dimColor> ✓ {domain}.public-key.pem</Text>}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text bold color={theme.colors.warning}>
          ⚠ Security Notice:
        </Text>
        <Text dimColor> - Private key will be exported with mode 0600</Text>
        <Text dimColor> - Export directory will be created with mode 0700</Text>
        <Text dimColor> - Ensure the export directory is secure</Text>
      </Box>
      {error && (
        <Box marginTop={1}>
          <Text color={theme.colors.danger}>✗ {error}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>Enter: Export | Esc: Cancel</Text>
      </Box>
    </Box>
  );
}
