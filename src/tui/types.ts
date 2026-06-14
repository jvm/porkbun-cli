/**
 * Core TUI types - normalized domain, DNS, nameserver, glue, forward, DNSSEC,
 * transfer, account, SSL metadata, request, form, selection, cache, and operation-result types.
 */

export interface NormalizedDomain {
  domain: string;
  status: string;
  tld: string;
  createDate?: string;
  expireDate?: string;
  securityLock: boolean;
  whoisPrivacy: boolean;
  autoRenew: boolean;
  apiAccess: boolean;
  notLocal: boolean;
  labels?: string[];
  raw: Record<string, unknown>;
}

export interface NormalizedDnsRecord {
  id: string;
  name: string;
  type: string;
  content: string;
  ttl?: number;
  prio?: number;
  notes?: string;
  raw: Record<string, unknown>;
}

export interface NormalizedGlueRecord {
  hostname: string;
  subdomain: string;
  ipv4: string[];
  ipv6: string[];
  ips: string[];
  raw: Record<string, unknown>;
}

export interface NormalizedForward {
  id: string;
  subdomain: string;
  location: string;
  type: 'permanent' | 'temporary';
  includePath: boolean;
  wildcard: boolean;
  raw: Record<string, unknown>;
}

export interface NormalizedDnssecRecord {
  keyTag: number;
  alg: number;
  digestType: number;
  digest: string;
  maxSigLife?: number;
  keyDataFlags?: number;
  keyDataProtocol?: number;
  keyDataAlgo?: number;
  keyDataPubKey?: string;
  raw: Record<string, unknown>;
}

export interface NormalizedTransfer {
  domain: string;
  status: string;
  statusDescription?: string;
  transferDate?: string;
  orderId?: string;
  raw: Record<string, unknown>;
}

export interface NormalizedAccountBalance {
  balanceCents: number;
  displayBalance: string;
  raw: Record<string, unknown>;
}

export interface NormalizedApiSettings {
  monthlySpendCents?: number;
  settings: Record<string, unknown>;
  raw: Record<string, unknown>;
}

export interface NormalizedSslBundle {
  certificateChain?: string;
  publicKey?: string;
  privateKey?: string;
  raw: Record<string, unknown>;
}

export type ResourceStatus = 'idle' | 'loading' | 'loaded' | 'stale' | 'error';

export interface ResourceState<T> {
  status: ResourceStatus;
  data?: T;
  error?: Error;
  timestamp?: number;
  requestId?: string;
  retryable?: boolean;
  stale?: boolean;
}

export interface DomainQuery {
  start?: number;
  includeLabels?: boolean;
  domain?: string;
  nameContains?: string;
  expiringWithinDays?: number;
  tlds?: string[];
  autoRenew?: boolean;
  apiAccess?: boolean;
  sortName?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface DomainSelection {
  type: 'none' | 'single' | 'multiple' | 'visible-page' | 'all-filter';
  domains: string[];
  filterDescriptor?: string;
  count: number;
}

export type ConfirmationLevel = 'standard' | 'disruptive' | 'bulk-disruptive' | 'billable';

export interface OperationContext {
  confirmationLevel: ConfirmationLevel;
  idempotencyKey?: string;
  inFlight: boolean;
  requestId?: string;
  result?: OperationResult;
}

export interface OperationResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: Error;
  requestId?: string;
}

export interface FormField<T = string> {
  value: T;
  error?: string;
  touched: boolean;
  sensitive?: boolean;
}

export interface FormState<T extends Record<string, unknown> = Record<string, unknown>> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  dirty: boolean;
  submitting: boolean;
  reviewSnapshot?: ReviewSnapshot;
}

export interface ReviewSnapshot {
  operation: string;
  target: string;
  classification: 'read-only' | 'mutating' | 'destructive' | 'billable';
  fields: Array<{ label: string; value: string; sensitive?: boolean }>;
  idempotencyKey?: string;
  expectedInvalidations?: string[];
}

export interface BulkOperationState {
  operation: string;
  domains: string[];
  concurrency: number;
  results: Map<string, BulkDomainResult>;
  inFlight: boolean;
  cancelled: boolean;
}

export interface BulkDomainResult {
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'cancelled';
  error?: Error;
  requestId?: string;
}

export interface TerminalCapabilities {
  columns: number;
  rows: number;
  color: boolean;
  unicode: boolean;
  mouse?: boolean;
}

export type Breakpoint = 'wide' | 'medium' | 'compact' | 'minimum';

export function getBreakpoint(cols: number, rows: number): Breakpoint {
  if (cols < 60 || rows < 18) return 'minimum';
  if (cols < 80) return 'compact';
  if (cols < 120) return 'medium';
  return 'wide';
}
