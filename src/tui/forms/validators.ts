/**
 * Form validation, normalization, review snapshot creation, and request payload building.
 *
 * Validation errors are returned as `Map<string, string>` rather than plain
 * `Record<string, string>`. Maps don't have a prototype chain, so they're
 * immune to the `__proto__` / `constructor` keys that eslint-plugin-security's
 * `detect-object-injection` rule flags on dynamic-key bracket access.
 */
import { isIP } from 'node:net';
import type { ReviewSnapshot } from '../types.js';

/** A field-level error map: validator-defined keys → human-readable messages. */
export type FormErrors = Map<string, string>;

// --- DNS Record Form ---

export interface DnsRecordFormValues {
  type: string;
  name: string;
  content: string;
  ttl: string;
  prio: string;
  notes: string;
}

const DNS_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'CAA', 'NS', 'PTR', 'SOA', 'TLSA', 'SSHFP', 'SPF'];

export function validateDnsRecordForm(values: DnsRecordFormValues): FormErrors {
  const errors: FormErrors = new Map();

  if (!values.type) {
    errors.set('type', 'Type is required.');
  } else if (!DNS_TYPES.includes(values.type.toUpperCase())) {
    errors.set('type', `Unknown record type '${values.type}'. Common types: ${DNS_TYPES.join(', ')}.`);
  }

  if (!values.content) {
    errors.set('content', 'Content is required.');
  }

  const type = values.type.toUpperCase();
  if (type === 'A' && values.content) {
    if (!isValidIPv4(values.content)) {
      errors.set('content', 'A record content must be a valid IPv4 address.');
    }
  }
  if (type === 'AAAA' && values.content) {
    if (!isValidIPv6(values.content)) {
      errors.set('content', 'AAAA record content must be a valid IPv6 address.');
    }
  }

  if (values.ttl && !isValidInteger(values.ttl)) {
    errors.set('ttl', 'TTL must be a valid integer.');
  }

  if (values.prio && !isValidInteger(values.prio)) {
    errors.set('prio', 'Priority must be a valid integer.');
  }

  // Warn but don't reject complex TXT/CAA/SRV
  return errors;
}

export function buildDnsRecordPayload(values: DnsRecordFormValues, parentDomain?: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    type: values.type.toUpperCase(),
    content: values.content,
  };
  const cleanedName = values.name.trim();
  // Three forms all mean "apex / root record" — submit with no name field:
  //   * empty
  //   * the literal '@'
  //   * equal to the parent domain (the FQDN returned by the read API
  //     when the record IS the apex; e.g. "example.com" + parent "example.com")
  const isApex =
    !cleanedName ||
    cleanedName === '@' ||
    (!!parentDomain && cleanedName.toLowerCase() === parentDomain.toLowerCase());
  if (!isApex) {
    payload.name = parentDomain ? stripParentDomain(cleanedName, parentDomain) : cleanedName;
  }
  if (values.ttl && isValidInteger(values.ttl)) payload.ttl = parseInt(values.ttl, 10);
  if (values.prio && isValidInteger(values.prio)) payload.prio = parseInt(values.prio, 10);
  if (values.notes) payload.notes = values.notes;
  return payload;
}

/**
 * Remove the parent-domain suffix from a DNS record name. The read API returns
 * fully qualified names (e.g. "www.example.com") but the write API expects the
 * subdomain label ("www"); the apex record uses an empty/omitted name.
 */
export function stripParentDomain(name: string, parentDomain: string): string {
  const suffix = `.${parentDomain.toLowerCase()}`;
  const lower = name.toLowerCase();
  if (lower.endsWith(suffix) && name.length > parentDomain.length + 1) {
    return name.slice(0, -parentDomain.length - 1);
  }
  return name;
}

export function buildDnsRecordReview(domain: string, values: DnsRecordFormValues, isEdit: boolean): ReviewSnapshot {
  return {
    operation: isEdit ? 'Edit DNS Record' : 'Create DNS Record',
    target: domain,
    classification: isEdit ? 'mutating' : 'mutating',
    fields: [
      { label: 'Type', value: values.type },
      { label: 'Name', value: values.name || '(root)' },
      { label: 'Content', value: values.content },
      { label: 'TTL', value: values.ttl || '(default)' },
      { label: 'Priority', value: values.prio || '(none)' },
      { label: 'Notes', value: values.notes || '(none)' },
    ],
  };
}

// --- Nameserver Form ---

export interface NameserverFormValues {
  nameservers: string[];
}

export function validateNameserverForm(values: NameserverFormValues): FormErrors {
  const errors: FormErrors = new Map();

  if (values.nameservers.length === 0) {
    errors.set('nameservers', 'At least one nameserver is required.');
    return errors;
  }

  values.nameservers.forEach((ns, i) => {
    if (!ns || !isValidHostname(ns)) {
      errors.set(`ns_${i}`, `Invalid hostname: '${ns}'`);
    }
  });

  return errors;
}

export function buildNameserverReview(domain: string, oldNs: string[], newNs: string[]): ReviewSnapshot {
  return {
    operation: 'Update Nameservers',
    target: domain,
    classification: 'mutating',
    fields: [
      { label: 'Current', value: oldNs.join(', ') || '(none)' },
      { label: 'New', value: newNs.join(', ') },
    ],
    expectedInvalidations: [`dns:${domain}`, `nameservers:${domain}`],
  };
}

// --- Glue Record Form ---

export interface GlueRecordFormValues {
  subdomain: string;
  ips: string[];
}

export function validateGlueForm(values: GlueRecordFormValues): FormErrors {
  const errors: FormErrors = new Map();

  if (!values.subdomain) {
    errors.set('subdomain', 'Subdomain is required.');
  }

  if (values.ips.length === 0) {
    errors.set('ips', 'At least one IP address is required.');
  }

  values.ips.forEach((ip, i) => {
    if (!isIP(ip)) {
      errors.set(`ip_${i}`, `Invalid IP address: '${ip}'`);
    }
  });

  return errors;
}

// --- URL Forward Form ---

export interface ForwardFormValues {
  subdomain: string;
  location: string;
  type: 'permanent' | 'temporary';
  includePath: boolean;
  wildcard: boolean;
}

export function validateForwardForm(values: ForwardFormValues): FormErrors {
  const errors: FormErrors = new Map();

  if (!values.location) {
    errors.set('location', 'Target URL is required.');
  } else {
    try {
      const url = new URL(values.location);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        errors.set('location', 'Target URL must use http or https.');
      }
    } catch {
      errors.set('location', 'Invalid URL format.');
    }
  }

  return errors;
}

export function buildForwardPayload(values: ForwardFormValues): Record<string, unknown> {
  return {
    subdomain: values.subdomain || undefined,
    location: values.location,
    type: values.type,
    includePath: values.includePath ? 'yes' : 'no',
    wildcard: values.wildcard ? 'yes' : 'no',
  };
}

// --- DNSSEC Form ---

export interface DnssecFormValues {
  keyTag: string;
  alg: string;
  digestType: string;
  digest: string;
  maxSigLife: string;
  keyDataFlags: string;
  keyDataProtocol: string;
  keyDataAlgo: string;
  keyDataPubKey: string;
}

export function validateDnssecForm(values: DnssecFormValues): FormErrors {
  const errors: FormErrors = new Map();

  if (!values.keyTag || !isValidInteger(values.keyTag)) {
    errors.set('keyTag', 'Key tag must be a valid integer.');
  }
  if (!values.alg || !isValidInteger(values.alg)) {
    errors.set('alg', 'Algorithm must be a valid integer.');
  }
  if (!values.digestType || !isValidInteger(values.digestType)) {
    errors.set('digestType', 'Digest type must be a valid integer.');
  }
  if (!values.digest) {
    errors.set('digest', 'Digest is required.');
  } else if (!/^[0-9a-fA-F]+$/.test(values.digest)) {
    errors.set('digest', 'Digest should be a hex string.');
  }

  // Advanced fields are optional
  if (values.maxSigLife && !isValidInteger(values.maxSigLife)) {
    errors.set('maxSigLife', 'Max signature life must be a valid integer.');
  }

  return errors;
}

// --- Registration Form ---

export interface RegistrationFormValues {
  domain: string;
  confirmDomain: string;
}

export function validateRegistrationConfirm(values: RegistrationFormValues): FormErrors {
  const errors: FormErrors = new Map();
  if (values.confirmDomain !== values.domain) {
    errors.set('confirmDomain', 'Type the exact domain name to confirm registration.');
  }
  return errors;
}

// --- Renewal Form ---

export interface RenewalFormValues {
  domain: string;
  confirmDomain: string;
  costCents: number;
}

export function validateRenewalConfirm(values: RenewalFormValues): FormErrors {
  const errors: FormErrors = new Map();
  if (values.confirmDomain !== values.domain) {
    errors.set('confirmDomain', 'Type the exact domain name to confirm renewal.');
  }
  return errors;
}

// --- Transfer Form ---

export interface TransferFormValues {
  domain: string;
  authCode: string;
  confirmDomain: string;
}

export function validateTransferForm(values: TransferFormValues): FormErrors {
  const errors: FormErrors = new Map();
  if (!values.domain) {
    errors.set('domain', 'Domain is required.');
  }
  if (!values.authCode) {
    errors.set('authCode', 'Authorization code is required.');
  }
  if (values.confirmDomain !== values.domain) {
    errors.set('confirmDomain', 'Type the exact domain name to confirm transfer.');
  }
  return errors;
}

// --- SSL Export Form ---

export interface SslExportFormValues {
  exportPath: string;
}

export function validateSslExportForm(values: SslExportFormValues): FormErrors {
  const errors: FormErrors = new Map();
  if (!values.exportPath) {
    errors.set('exportPath', 'Export directory path is required.');
  }
  return errors;
}

// --- Price Conversion ---

/**
 * Convert a price string (e.g., "9.73") to integer cents.
 * Never use binary floating point for money.
 *
 * The validation is split into two anchored regexes (no nested quantifiers)
 * rather than `/^\d+(\.\d{0,2})?$/`, which eslint-plugin-security's
 * `detect-unsafe-regex` flags even though it is bounded.
 */
export function priceStringToCents(priceStr: string): number | undefined {
  const cleaned = priceStr.replace(/[^0-9.]/g, '');
  if (!cleaned) return undefined;
  const isInteger = /^\d+$/.test(cleaned);
  const isDecimal = /^\d+\.\d{1,2}$/.test(cleaned);
  if (!isInteger && !isDecimal) return undefined;
  const parts = cleaned.split('.');
  const dollars = parseInt(parts[0] || '0', 10);
  const centsStr = (parts[1] || '').padEnd(2, '0').slice(0, 2);
  const cents = parseInt(centsStr, 10);
  return dollars * 100 + cents;
}

/**
 * Format cents to USD display string.
 */
export function centsToUsd(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absCents = Math.abs(cents);
  const dollars = Math.floor(absCents / 100);
  const remainder = absCents % 100;
  return `${sign}$${dollars}.${String(remainder).padStart(2, '0')}`;
}

// --- Auto-renew Form ---

export function buildAutoRenewReview(
  domains: string[],
  previousState: Map<string, boolean>,
  newState: 'on' | 'off',
): ReviewSnapshot {
  return {
    operation: `Auto-renew ${newState}`,
    target: domains.join(', '),
    classification: 'mutating',
    fields: domains.map(d => ({
      label: d,
      value: `${previousState.get(d) === true ? 'on' : 'off'} → ${newState}`,
    })),
    expectedInvalidations: domains.map(d => `domain:${d}`),
  };
}

// --- Helpers ---

function isValidIPv4(value: string): boolean {
  return isIP(value) === 4;
}

function isValidIPv6(value: string): boolean {
  return isIP(value) === 6;
}

/**
 * Validate an RFC-1123 hostname by inspecting each dot-separated label
 * manually rather than with a single complex regex. A single regex with
 * `(\.[a-zA-Z0-9](...)?)*` triggers eslint-plugin-security's
 * `detect-unsafe-regex` (nested optional groups), even though the input
 * length is bounded.
 */
function isValidHostname(value: string): boolean {
  if (!value || value.length > 253) return false;
  const labels = value.split('.');
  if (labels.length < 2) return false;
  for (const label of labels) {
    if (!isValidLabel(label)) return false;
  }
  return true;
}

function isValidLabel(label: string): boolean {
  if (label.length === 0 || label.length > 63) return false;
  for (let i = 0; i < label.length; i++) {
    const code = label.charCodeAt(i);
    const isAlnum =
      (code >= 0x30 && code <= 0x39) || // 0-9
      (code >= 0x41 && code <= 0x5A) || // A-Z
      (code >= 0x61 && code <= 0x7A);   // a-z
    const isHyphen = code === 0x2D;
    if (!isAlnum && !isHyphen) return false;
    const atEdge = i === 0 || i === label.length - 1;
    if (atEdge && !isAlnum) return false;
  }
  return true;
}

function isValidInteger(value: string): boolean {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && String(parsed) === value.trim();
}
