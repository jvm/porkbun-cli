/**
 * Core TUI types - normalized domain, DNS, nameserver, glue, forward, DNSSEC,
 * transfer, account, SSL metadata, request, form, selection, cache, and operation-result types.
 */

export interface NormalizedDomain {
  domain: string;
  status: string;
  tld: string;
  createDate?: string | undefined;
  expireDate?: string | undefined;
  securityLock: boolean;
  whoisPrivacy: boolean;
  autoRenew: boolean;
  apiAccess: boolean;
  notLocal: boolean;
  labels?: string[] | undefined;
  raw: Record<string, unknown>;
}

export interface NormalizedDnsRecord {
  id: string;
  name: string;
  type: string;
  content: string;
  ttl?: number | undefined;
  prio?: number | undefined;
  notes?: string | undefined;
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
  type: "permanent" | "temporary";
  includePath: boolean;
  wildcard: boolean;
  raw: Record<string, unknown>;
}

export interface NormalizedDnssecRecord {
  keyTag: number;
  alg: number;
  digestType: number;
  digest: string;
  maxSigLife?: number | undefined;
  keyDataFlags?: number | undefined;
  keyDataProtocol?: number | undefined;
  keyDataAlgo?: number | undefined;
  keyDataPubKey?: string | undefined;
  raw: Record<string, unknown>;
}

export interface NormalizedTransfer {
  domain: string;
  status: string;
  statusDescription?: string | undefined;
  transferDate?: string | undefined;
  orderId?: string | undefined;
  raw: Record<string, unknown>;
}

export interface NormalizedAccountBalance {
  balanceCents: number;
  displayBalance: string;
  raw: Record<string, unknown>;
}

export interface NormalizedApiSettings {
  monthlySpendCents?: number | undefined;
  settings: Record<string, unknown>;
  raw: Record<string, unknown>;
}

export interface NormalizedSslBundle {
  certificateChain?: string | undefined;
  publicKey?: string | undefined;
  privateKey?: string | undefined;
  raw: Record<string, unknown>;
}

export type ResourceStatus = "idle" | "loading" | "loaded" | "stale" | "error";

export interface ResourceState<T> {
  status: ResourceStatus;
  data?: T | undefined;
  error?: Error | undefined;
  timestamp?: number | undefined;
  requestId?: string | undefined;
  retryable?: boolean | undefined;
  stale?: boolean | undefined;
}

export interface DomainQuery {
  start?: number | undefined;
  includeLabels?: boolean | undefined;
  domain?: string | undefined;
  nameContains?: string | undefined;
  expiringWithinDays?: number | undefined;
  tlds?: string[] | undefined;
  autoRenew?: boolean | undefined;
  apiAccess?: boolean | undefined;
  sortName?: string | undefined;
  sortDirection?: "asc" | "desc" | undefined;
}

export interface DomainSelection {
  type: "none" | "single" | "multiple" | "visible-page" | "all-filter";
  domains: string[];
  filterDescriptor?: string | undefined;
  count: number;
}

export type ConfirmationLevel = "standard" | "disruptive" | "bulk-disruptive" | "billable";

export interface OperationContext {
  confirmationLevel: ConfirmationLevel;
  idempotencyKey?: string | undefined;
  inFlight: boolean;
  requestId?: string | undefined;
  result?: OperationResult | undefined;
}

export interface OperationResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: Error | undefined;
  requestId?: string | undefined;
}

export interface FormField<T = string> {
  value: T;
  error?: string | undefined;
  touched: boolean;
  sensitive?: boolean | undefined;
}

export interface FormState<T extends Record<string, unknown> = Record<string, unknown>> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  dirty: boolean;
  submitting: boolean;
  reviewSnapshot?: ReviewSnapshot | undefined;
}

export interface ReviewSnapshot {
  operation: string;
  target: string;
  classification: "read-only" | "mutating" | "destructive" | "billable";
  fields: Array<{ label: string; value: string; sensitive?: boolean | undefined }>;
  idempotencyKey?: string | undefined;
  expectedInvalidations?: string[] | undefined;
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
  status: "pending" | "running" | "succeeded" | "failed" | "skipped" | "cancelled";
  error?: Error | undefined;
  requestId?: string | undefined;
}

export interface TerminalCapabilities {
  columns: number;
  rows: number;
  color: boolean;
  unicode: boolean;
  mouse?: boolean | undefined;
}

export type Breakpoint = "wide" | "medium" | "compact" | "minimum";

export function getBreakpoint(cols: number, rows: number): Breakpoint {
  if (cols < 60 || rows < 18) return "minimum";
  if (cols < 80) return "compact";
  if (cols < 120) return "medium";
  return "wide";
}
