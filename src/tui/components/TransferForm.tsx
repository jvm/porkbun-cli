import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { TuiApiService } from "../services/api.js";
import type { Theme } from "../theme.js";
import { priceStringToCents } from "../forms/validators.js";

export interface TransferFormProps {
  theme: Theme;
  service: TuiApiService;
  balanceCents?: number;
  onTransfer: (domain: string, cost: number, authCode: string) => Promise<void>;
  onCancel: () => void;
}

interface TransferPricingResult {
  cost?: number;
  reason?: string;
}

export function TransferForm({
  theme,
  service,
  balanceCents,
  onTransfer,
  onCancel,
}: TransferFormProps) {
  const [domain, setDomain] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [step, setStep] = useState<"input" | "checking" | "confirm">("input");
  const [pricing, setPricing] = useState<TransferPricingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmationText, setConfirmationText] = useState("");

  const checkPricing = async () => {
    if (!domain || !domain.includes(".")) {
      setError("Please enter a valid domain name (e.g., example.com)");
      return;
    }

    if (!authCode) {
      setError("Authorization code is required for transfers");
      return;
    }

    setStep("checking");
    setError(null);

    try {
      // Prefer the per-domain transfer price from checkDomain; fall back to
      // the generic TLD tariff only if the per-domain price is missing.
      let priceStr: string | undefined;
      try {
        priceStr = await service.getDomainPriceFromCheck(domain, "transfer");
      } catch {
        priceStr = undefined;
      }
      if (!priceStr) {
        priceStr = await service.getTldPrice(domain, "transfer");
      }
      const parsed = priceStr ? priceStringToCents(priceStr) : undefined;
      if (parsed !== undefined) {
        setPricing({ cost: parsed });
        setStep("confirm");
      } else {
        setPricing({ reason: "Transfer pricing not available from API" });
        setError("Transfer pricing not available. Please check the Porkbun website.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStep("confirm");
    }
  };

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (step === "input") {
      if (key.return && domain && authCode) {
        checkPricing();
      }
    } else if (step === "confirm" && pricing?.cost) {
      if (key.return && confirmationText === domain) {
        onTransfer(domain, pricing.cost, authCode);
      }
    }
  });

  if (step === "input" || step === "checking") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Transfer Domain to Porkbun</Text>
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text>Domain: </Text>
            <TextInput value={domain} onChange={setDomain} placeholder="example.com" />
          </Box>
          <Box>
            <Text>Authorization Code: </Text>
            <TextInput
              value={authCode}
              onChange={setAuthCode}
              placeholder="Auth code from current registrar"
            />
          </Box>
          {error && (
            <Box marginTop={1}>
              <Text color={theme.colors.danger}>{error}</Text>
            </Box>
          )}
          {step === "checking" && (
            <Box marginTop={1}>
              <Text dimColor>Checking transfer pricing...</Text>
            </Box>
          )}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Enter: Check pricing | Esc: Cancel</Text>
        </Box>
      </Box>
    );
  }

  if (error || !pricing?.cost) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color={theme.colors.danger}>
          Cannot transfer domain
        </Text>
        <Box marginTop={1}>
          <Text>{error || pricing?.reason || "Unknown error"}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Esc: Cancel</Text>
        </Box>
      </Box>
    );
  }

  const canAfford = balanceCents !== undefined && balanceCents >= pricing.cost;

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color={theme.colors.danger}>
        ⚠ Billable Operation: Transfer Domain
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text>Domain: </Text>
          <Text bold>{domain}</Text>
        </Box>
        <Box>
          <Text>Authorization Code: </Text>
          <Text dimColor>{"•".repeat(Math.min(authCode.length, 20))}</Text>
        </Box>
        <Box>
          <Text>Transfer cost: </Text>
          <Text bold color={theme.colors.danger}>
            ${(pricing.cost / 100).toFixed(2)}
          </Text>
          <Text dimColor> (includes 1 year extension)</Text>
        </Box>
        {balanceCents !== undefined && (
          <Box>
            <Text>Account balance: </Text>
            <Text color={canAfford ? theme.colors.success : theme.colors.danger}>
              ${(balanceCents / 100).toFixed(2)}
            </Text>
            {!canAfford && <Text color={theme.colors.danger}> (insufficient funds)</Text>}
          </Box>
        )}
        <Box marginTop={1} flexDirection="column">
          <Text bold>This action will:</Text>
          <Text>• Initiate transfer from current registrar</Text>
          <Text>• Charge your account balance immediately</Text>
          <Text>• Take 5-7 days to complete</Text>
          <Text>• Extend domain by 1 year upon successful transfer</Text>
        </Box>
        {canAfford && (
          <Box marginTop={1} flexDirection="column">
            <Text bold color={theme.colors.warning}>
              To confirm, type the domain name exactly:
            </Text>
            <Box>
              <Text>Type: </Text>
              <TextInput value={confirmationText} onChange={setConfirmationText} />
            </Box>
            {confirmationText && confirmationText !== domain && (
              <Text color={theme.colors.danger}>Does not match! Type: {domain}</Text>
            )}
          </Box>
        )}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>{canAfford ? "Enter: Initiate transfer | Esc: Cancel" : "Esc: Cancel"}</Text>
      </Box>
    </Box>
  );
}
