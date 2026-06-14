import React, { useState, useEffect } from "react";
import { Box, useInput } from "ink";
import { Text } from "../text.js";
import TextInput from "ink-text-input";
import type { NormalizedDomain } from "../types.js";
import type { TuiApiService } from "../services/api.js";
import type { Theme } from "../theme.js";
import { priceStringToCents } from "../forms/validators.js";

export interface RenewFormProps {
  theme: Theme;
  service: TuiApiService;
  domain: NormalizedDomain;
  balanceCents?: number;
  onRenew: (domain: string, cost: number) => Promise<void>;
  onCancel: () => void;
}

interface RenewalPricingResult {
  cost?: number | undefined;
  reason?: string | undefined;
}

export function RenewForm({
  theme,
  service,
  domain,
  balanceCents,
  onRenew,
  onCancel,
}: RenewFormProps) {
  const [pricing, setPricing] = useState<RenewalPricingResult | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmationText, setConfirmationText] = useState("");

  // Check renewal pricing on mount
  useEffect(() => {
    const checkPricing = async () => {
      try {
        // Prefer the per-domain renewal price from checkDomain — it reflects
        // premium or otherwise domain-specific pricing. The /pricing/get
        // endpoint only exposes the generic TLD tariff, which can be wrong
        // for premium names and is also rejected by the renew endpoint
        // when it does not match the exact domain total.
        let priceStr: string | undefined;
        try {
          priceStr = await service.getDomainPriceFromCheck(domain.domain, "renewal");
        } catch {
          priceStr = undefined;
        }
        if (!priceStr) {
          priceStr = await service.getTldPrice(domain.domain, "renewal");
        }
        const parsed = priceStr ? priceStringToCents(priceStr) : undefined;
        if (parsed !== undefined) {
          setPricing({ cost: parsed });
        } else {
          setPricing({
            reason: "Renewal pricing not available from API. Please check the Porkbun website.",
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setChecking(false);
      }
    };

    checkPricing();
  }, [domain.domain, service]);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return && pricing?.cost && confirmationText === domain.domain) {
      onRenew(domain.domain, pricing.cost);
    }
  });

  if (checking) {
    return (
      <Box padding={1}>
        <Text dimColor>Checking renewal pricing...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color={theme.colors.danger}>
          Error checking renewal pricing
        </Text>
        <Box marginTop={1}>
          <Text color={theme.colors.danger}>{error}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Esc: Cancel</Text>
        </Box>
      </Box>
    );
  }

  if (!pricing?.cost) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color={theme.colors.warning}>
          Cannot renew via TUI
        </Text>
        <Box marginTop={1}>
          <Text>{pricing?.reason || "Renewal pricing not available"}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Domain: {domain.domain}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Current expiration: {domain.expireDate || "Unknown"}</Text>
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
        ⚠ Billable Operation: Renew Domain
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text>Domain: </Text>
          <Text bold>{domain.domain}</Text>
        </Box>
        <Box>
          <Text>Current expiration: </Text>
          <Text dimColor>{domain.expireDate || "Unknown"}</Text>
        </Box>
        <Box>
          <Text>Renewal cost: </Text>
          <Text bold color={theme.colors.danger}>
            ${(pricing.cost / 100).toFixed(2)}
          </Text>
          <Text dimColor> (extend by 1 year)</Text>
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
          <Text>• Extend domain registration by 1 year</Text>
          <Text>• Charge your account balance immediately</Text>
          <Text>• Be irreversible after completion</Text>
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
            {confirmationText && confirmationText !== domain.domain && (
              <Text color={theme.colors.danger}>Does not match! Type: {domain.domain}</Text>
            )}
          </Box>
        )}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>{canAfford ? "Enter: Renew | Esc: Cancel" : "Esc: Cancel"}</Text>
      </Box>
    </Box>
  );
}
