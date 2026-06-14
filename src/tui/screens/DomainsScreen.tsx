/**
 * DomainsScreen - portfolio list with search, filter, sort, pagination, and selection.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Theme } from '../theme.js';
import type { TuiApiService } from '../services/api.js';
import type { NormalizedDomain, ReviewSnapshot, ConfirmationLevel } from '../types.js';
import { VirtualList } from '../components/VirtualList.js';
import { LoadingState, ErrorState, EmptyState, StaleBanner } from '../components/StatusComponents.js';
import { MutationConfirm } from '../components/MutationConfirm.js';
import { CommandPalette, type Command } from '../components/CommandPalette.js';
import { ContextHelp } from '../components/ContextHelp.js';

interface DomainsScreenProps {
  service: TuiApiService;
  theme: Theme;
  onOpenDomain: (domain: string) => void;
  onOpenTransfers: () => void;
  onOpenRegister: () => void;
  onOpenAccount: () => void;
  onOpenHelp: () => void;
  balanceCents?: number;
}

type SearchPhase = 'inactive' | 'active';

const FRESHNESS_WINDOW_MS = 30_000;

export function DomainsScreen({ service, theme, onOpenDomain, onOpenTransfers, onOpenRegister, onOpenAccount, onOpenHelp, balanceCents }: DomainsScreenProps) {
  const [domains, setDomains] = useState<NormalizedDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchMode, setSearchMode] = useState<SearchPhase>('inactive');
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
  const [freshnessTimestamp, setFreshnessTimestamp] = useState<number | undefined>();
  
  // Auto-renew mutation state
  const [autoRenewMode, setAutoRenewMode] = useState<'idle' | 'confirm' | 'submitting' | 'success' | 'error'>('idle');
  const [autoRenewTargets, setAutoRenewTargets] = useState<string[]>([]);
  const [autoRenewNewState, setAutoRenewNewState] = useState<boolean>(false);
  const [autoRenewSnapshot, setAutoRenewSnapshot] = useState<ReviewSnapshot | undefined>();
  const [autoRenewError, setAutoRenewError] = useState<string | undefined>();
  const [autoRenewSuccess, setAutoRenewSuccess] = useState<string | undefined>();
  
  // Command palette and help modal state
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showContextHelp, setShowContextHelp] = useState(false);

  // Debounce search
  useEffect(() => {
    if (searchMode !== 'active') return;
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchText, searchMode]);

  // Load domains
  const loadDomains = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    const result = await service.getDomains({
      includeLabels: true,
      nameContains: debouncedSearch || undefined,
    });
    setLoading(false);
    if (result.status === 'loaded' && result.data) {
      setDomains(result.data.domains);
      setFreshnessTimestamp(Date.now());
    } else if (result.error) {
      setError(result.error);
    }
  }, [service, debouncedSearch]);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  // Check staleness
  const isStale = useMemo(() => {
    if (!freshnessTimestamp) return false;
    return Date.now() - freshnessTimestamp > FRESHNESS_WINDOW_MS;
  }, [freshnessTimestamp, domains]);

  // Filter domains client-side
  const filteredDomains = useMemo(() => {
    if (!debouncedSearch) return domains;
    const lower = debouncedSearch.toLowerCase();
    return domains.filter(d => d.domain.toLowerCase().includes(lower));
  }, [domains, debouncedSearch]);

  // Handle input
  useInput((char, key) => {
    // Dismiss auto-renew result
    if (autoRenewMode === 'success' || autoRenewMode === 'error') {
      setAutoRenewMode('idle');
      setAutoRenewTargets([]);
      setAutoRenewSnapshot(undefined);
      setAutoRenewError(undefined);
      setAutoRenewSuccess(undefined);
      return;
    }
    
    // Cancel auto-renew confirm with Escape
    if (autoRenewMode === 'confirm' && key.escape) {
      setAutoRenewMode('idle');
      setAutoRenewTargets([]);
      setAutoRenewSnapshot(undefined);
      return;
    }
    
    // Don't process other keys during auto-renew confirm
    if (autoRenewMode === 'confirm') {
      return;
    }
    
    // Command palette and help modals
    if (showCommandPalette || showContextHelp) {
      return;
    }
    
    if (searchMode === 'active') {
      if (key.escape) {
        setSearchMode('inactive');
        setSearchText('');
        setDebouncedSearch('');
      } else if (key.return) {
        setSearchMode('inactive');
      } else if (key.backspace || key.delete) {
        setSearchText(prev => prev.slice(0, -1));
      } else if (char && !key.ctrl && !key.meta) {
        setSearchText(prev => prev + char);
      }
      return;
    }

    // Navigation
    if (char === '2') { onOpenTransfers(); return; }
    if (char === '3') { onOpenRegister(); return; }
    if (char === '4') { onOpenAccount(); return; }
    
    // Command palette and help
    if (char === ':') {
      setShowCommandPalette(true);
      return;
    }
    if (char === '?') {
      setShowContextHelp(true);
      return;
    }

    // Search
    if (char === '/') {
      setSearchMode('active');
      return;
    }

    // Refresh
    if (char === 'r') {
      loadDomains();
      return;
    }

    // Auto-renew toggle
    if (char === 'a' || char === 'A') {
      const targets = selectedDomains.size > 0 
        ? Array.from(selectedDomains) 
        : filteredDomains[selectedIndex] ? [filteredDomains[selectedIndex].domain] : [];
      
      if (targets.length > 0) {
        // Determine new state (toggle based on first domain's current state)
        const firstDomain = domains.find(d => d.domain === targets[0]);
        const newState = firstDomain ? !firstDomain.autoRenew : true;
        
        setAutoRenewTargets(targets);
        setAutoRenewNewState(newState);
        
        const snapshot: ReviewSnapshot = {
          operation: newState ? 'Enable Auto-Renew' : 'Disable Auto-Renew',
          target: targets.length === 1 ? targets[0] : `${targets.length} domains`,
          classification: 'mutating',
          fields: targets.map(d => ({
            label: d,
            value: newState ? 'Enable' : 'Disable',
          })),
        };
        setAutoRenewSnapshot(snapshot);
        setAutoRenewMode('confirm');
      }
      return;
    }

    // List navigation
    if (key.upArrow || char === 'k') {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow || char === 'j') {
      setSelectedIndex(prev => Math.min(filteredDomains.length - 1, prev + 1));
    } else if (key.pageUp) {
      setSelectedIndex(prev => Math.max(0, prev - 20));
    } else if (key.pageDown) {
      setSelectedIndex(prev => Math.min(filteredDomains.length - 1, prev + 20));
    } else if (key.return) {
      const domain = filteredDomains[selectedIndex];
      if (domain) onOpenDomain(domain.domain);
    } else if (char === ' ') {
      const domain = filteredDomains[selectedIndex];
      if (domain) {
        setSelectedDomains(prev => {
          const next = new Set(prev);
          if (next.has(domain.domain)) {
            next.delete(domain.domain);
          } else {
            next.add(domain.domain);
          }
          return next;
        });
      }
    } else if (char === 'q') {
      process.exit(0);
    }
  });

  // Command palette commands
  const commands: Command[] = [
    {
      id: 'toggle-autorenew',
      name: 'Toggle Auto-Renew',
      description: `Toggle auto-renew for ${selectedDomains.size > 0 ? `${selectedDomains.size} selected` : 'selected'} domain(s)`,
      classification: 'mutating',
      disabled: selectedDomains.size === 0,
      disabledReason: 'No domains selected',
      onExecute: () => {
        const targets = Array.from(selectedDomains);
        const firstDomain = domains.find(d => d.domain === targets[0]);
        const newState = firstDomain ? !firstDomain.autoRenew : true;
        setAutoRenewTargets(targets);
        setAutoRenewNewState(newState);
        setAutoRenewSnapshot({
          operation: newState ? 'Enable Auto-Renew' : 'Disable Auto-Renew',
          target: targets.length === 1 ? targets[0] : `${targets.length} domains`,
          classification: 'mutating',
          fields: targets.map(d => ({ label: d, value: newState ? 'Enable' : 'Disable' })),
        });
        setAutoRenewMode('confirm');
      },
    },
    {
      id: 'open-domain',
      name: 'Open Domain',
      description: 'Open the selected domain for editing',
      classification: 'read-only',
      onExecute: () => {
        const domain = filteredDomains[selectedIndex];
        if (domain) onOpenDomain(domain.domain);
      },
    },
    {
      id: 'go-transfers',
      name: 'Go to Transfers',
      description: 'View and manage domain transfers',
      classification: 'read-only',
      onExecute: () => onOpenTransfers(),
    },
    {
      id: 'go-register',
      name: 'Register Domain',
      description: 'Register a new domain',
      classification: 'billable',
      onExecute: () => onOpenRegister(),
    },
    {
      id: 'go-account',
      name: 'Go to Account',
      description: 'View account balance and settings',
      classification: 'read-only',
      onExecute: () => onOpenAccount(),
    },
    {
      id: 'refresh',
      name: 'Refresh',
      description: 'Refresh the domain list',
      classification: 'read-only',
      onExecute: () => loadDomains(),
    },
    {
      id: 'select-all',
      name: 'Select All',
      description: `Select all ${filteredDomains.length} filtered domains`,
      classification: 'read-only',
      onExecute: () => {
        setSelectedDomains(new Set(filteredDomains.map(d => d.domain)));
      },
    },
    {
      id: 'deselect-all',
      name: 'Deselect All',
      description: 'Clear all selections',
      classification: 'read-only',
      disabled: selectedDomains.size === 0,
      disabledReason: 'No domains selected',
      onExecute: () => setSelectedDomains(new Set()),
    },
  ];

  if (loading && domains.length === 0) {
    return <LoadingState message="Loading domains..." theme={theme} />;
  }

  if (error) {
    return <ErrorState error={error} retryable onRetry={loadDomains} theme={theme} />;
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Search bar */}
      <Box marginBottom={1}>
        <Text bold color={theme.colors.primary}>Domains</Text>
        <Text dimColor> ({filteredDomains.length})</Text>
        {balanceCents !== undefined && (
          <Text dimColor> | Balance: ${ (balanceCents / 100).toFixed(2)}</Text>
        )}
        {searchMode === 'active' && (
          <>
            <Text> | Search: </Text>
            <Text color={theme.colors.warning}>{searchText}_</Text>
          </>
        )}
        {selectedDomains.size > 0 && (
          <Text color={theme.colors.info}> | {selectedDomains.size} selected</Text>
        )}
      </Box>

      {/* Stale banner */}
      {isStale && <StaleBanner theme={theme} />}

      {/* Domain list */}
      {filteredDomains.length === 0 ? (
        <EmptyState message="No domains found." details={debouncedSearch ? `No matches for "${debouncedSearch}"` : undefined} theme={theme} />
      ) : (
        <VirtualList
          items={filteredDomains}
          selectedIndex={selectedIndex}
          maxVisible={30}
          theme={theme}
          renderItem={(domain, index, isSelected) => (
            <DomainRow
              domain={domain}
              isSelected={isSelected}
              isMultiSelected={selectedDomains.has(domain.domain)}
              theme={theme}
            />
          )}
        />
      )}
      
      {/* Auto-renew confirmation */}
      {autoRenewMode === 'confirm' && autoRenewSnapshot && (
        <MutationConfirm
          theme={theme}
          review={autoRenewSnapshot}
          confirmationLevel={autoRenewTargets.length > 1 ? 'bulk-disruptive' : 'standard'}
          onConfirm={async () => {
            setAutoRenewMode('submitting');
            setAutoRenewError(undefined);
            setAutoRenewSuccess(undefined);
            
            try {
              const status = autoRenewNewState ? 'on' : 'off';
              for (const domain of autoRenewTargets) {
                const result = await service.updateAutoRenew(domain, status);
                if (result.status === 'error' && result.error) {
                  throw new Error(`Failed to update ${domain}: ${result.error.message}`);
                }
              }
              setAutoRenewSuccess(`Auto-renew ${autoRenewNewState ? 'enabled' : 'disabled'} for ${autoRenewTargets.length} domain(s)`);
              setAutoRenewMode('success');
              await loadDomains();
            } catch (err) {
              setAutoRenewError(err instanceof Error ? err.message : String(err));
              setAutoRenewMode('error');
            }
          }}
          onBack={() => {
            setAutoRenewMode('idle');
            setAutoRenewTargets([]);
            setAutoRenewSnapshot(undefined);
          }}
          onCancel={() => {
            setAutoRenewMode('idle');
            setAutoRenewTargets([]);
            setAutoRenewSnapshot(undefined);
            setAutoRenewError(undefined);
          }}
          submitting={false}
        />
      )}
      
      {/* Auto-renew result */}
      {(autoRenewMode === 'success' || autoRenewMode === 'error') && (
        <Box marginTop={1} flexDirection="column">
          {autoRenewSuccess && (
            <Text color={theme.colors.success}>✓ {autoRenewSuccess}</Text>
          )}
          {autoRenewError && (
            <Text color={theme.colors.danger}>✗ {autoRenewError}</Text>
          )}
          <Text dimColor>Press any key to continue...</Text>
        </Box>
      )}
      
      {/* Command Palette Modal */}
      {showCommandPalette && (
        <CommandPalette
          theme={theme}
          commands={commands}
          onClose={() => setShowCommandPalette(false)}
        />
      )}
      
      {/* Context Help Modal */}
      {showContextHelp && (
        <ContextHelp
          theme={theme}
          context="domains"
          onClose={() => setShowContextHelp(false)}
        />
      )}
    </Box>
  );
}

interface DomainRowProps {
  domain: NormalizedDomain;
  isSelected: boolean;
  isMultiSelected: boolean;
  theme: Theme;
}

function DomainRow({ domain, isSelected, isMultiSelected, theme }: DomainRowProps) {
  const attention = getAttentionIndicator(domain, theme);
  const relativeExpiry = domain.expireDate ? getRelativeExpiry(domain.expireDate) : '';

  return (
    <Box>
      <Text
        backgroundColor={isSelected ? theme.colors.selectedBg : undefined}
        color={isSelected ? theme.colors.selected : undefined}
      >
        {isSelected ? theme.icons.selected : theme.icons.unselected}
        {isMultiSelected ? theme.icons.check : ' '}
        {' '}
      </Text>
      <Text
        backgroundColor={isSelected ? theme.colors.selectedBg : undefined}
        color={isSelected ? theme.colors.selected : undefined}
      >
        {domain.domain.padEnd(35)}
      </Text>
      <Text dimColor>{domain.expireDate?.split('T')[0] ?? ''}</Text>
      <Text dimColor> ({relativeExpiry})</Text>
      <Text color={domain.autoRenew ? theme.colors.success : theme.colors.danger}>
        {' '}AR:{domain.autoRenew ? theme.icons.check : theme.icons.cross}
      </Text>
      <Text color={domain.apiAccess ? theme.colors.success : theme.colors.warning}>
        {' '}API:{domain.apiAccess ? theme.icons.check : theme.icons.cross}
      </Text>
      {attention && <Text color={attention.color}> {attention.icon}</Text>}
    </Box>
  );
}

function getAttentionIndicator(domain: NormalizedDomain, theme: Theme): { icon: string; color: string | undefined } | null {
  if (domain.status === 'INACTIVE' || domain.status === 'ERROR') {
    return { icon: theme.icons.warning, color: theme.colors.danger };
  }
  if (domain.expireDate) {
    const days = getDaysUntilExpiry(domain.expireDate);
    if (days < 0) return { icon: theme.icons.cross, color: theme.colors.danger };
    if (days <= 7) return { icon: theme.icons.warning, color: theme.colors.danger };
    if (days <= 30) return { icon: theme.icons.warning, color: theme.colors.warning };
    if (days <= 90) return { icon: theme.icons.info, color: theme.colors.warning };
  }
  if (!domain.autoRenew) return { icon: theme.icons.warning, color: theme.colors.warning };
  if (!domain.apiAccess) return { icon: theme.icons.info, color: theme.colors.muted };
  return null;
}

function getDaysUntilExpiry(expireDate: string): number {
  const expiry = new Date(expireDate);
  const now = new Date();
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getRelativeExpiry(expireDate: string): string {
  const days = getDaysUntilExpiry(expireDate);
  if (days < 0) return `expired ${Math.abs(days)}d ago`;
  if (days === 0) return 'expires today';
  if (days === 1) return 'expires tomorrow';
  if (days <= 30) return `${days}d`;
  if (days <= 365) return `${Math.floor(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}
