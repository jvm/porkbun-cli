/**
 * Form validation, normalization, review snapshot creation, and request payload building.
 */
import { isIP } from 'node:net';
import type { ReviewSnapshot, ConfirmationLevel } from '../types.js';
import { redactReviewValue } from '../redact.js';

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

export function validateDnsRecordForm(values: DnsRecordFormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.type) {
    errors.type = 'Type is required.';
  } else if (!DNS_TYPES.includes(values.type.toUpperCase())) {
    errors.type = `Unknown record type '${values.type}'. Common types: ${DNS_TYPES.join(', ')}.`;
  }

  if (!values.content) {
    errors.content = 'Content is required.';
  }

  const type = values.type.toUpperCase();
  if (type === 'A' && values.content) {
    if (!isValidIPv4(values.content)) {
      errors.content = 'A record content must be a valid IPv4 address.';
    }
  }
  if (type === 'AAAA' && values.content) {
    if (!isValidIPv6(values.content)) {
      errors.content = 'AAAA record content must be a valid IPv6 address.';
    }
  }

  if (values.ttl && !isValidInteger(values.ttl)) {
    errors.ttl = 'TTL must be a valid integer.';
  }

  if (values.prio && !isValidInteger(values.prio)) {
    errors.prio = 'Priority must be a valid integer.';
  }

  // Warn but don't reject complex TXT/CAA/SRV
  return errors;
}

export function buildDnsRecordPayload(values: DnsRecordFormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    type: values.type.toUpperCase(),
    content: values.content,
  };
  if (values.name) payload.name = values.name;
  if (values.ttl && isValidInteger(values.ttl)) payload.ttl = parseInt(values.ttl, 10);
  if (values.prio && isValidInteger(values.prio)) payload.prio = parseInt(values.prio, 10);
  if (values.notes) payload.notes = values.notes;
  return payload;
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

export function validateNameserverForm(values: NameserverFormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (values.nameservers.length === 0) {
    errors.nameservers = 'At least one nameserver is required.';
    return errors;
  }

  for (let i = 0; i < values.nameservers.length; i++) {
    const ns = values.nameservers[i];
    if (!ns || !isValidHostname(ns)) {
      errors[`ns_${i}`] = `Invalid hostname: '${ns}'`;
    }
  }

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

export function validateGlueForm(values: GlueRecordFormValues, parentDomain: string): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.subdomain) {
    errors.subdomain = 'Subdomain is required.';
  }

  if (values.ips.length === 0) {
    errors.ips = 'At least one IP address is required.';
  }

  for (let i = 0; i < values.ips.length; i++) {
    const ip = values.ips[i];
    if (!isIP(ip)) {
      errors[`ip_${i}`] = `Invalid IP address: '${ip}'`;
    }
  }

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

export function validateForwardForm(values: ForwardFormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.location) {
    errors.location = 'Target URL is required.';
  } else {
    try {
      const url = new URL(values.location);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        errors.location = 'Target URL must use http or https.';
      }
    } catch {
      errors.location = 'Invalid URL format.';
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

export function validateDnssecForm(values: DnssecFormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.keyTag || !isValidInteger(values.keyTag)) {
    errors.keyTag = 'Key tag must be a valid integer.';
  }
  if (!values.alg || !isValidInteger(values.alg)) {
    errors.alg = 'Algorithm must be a valid integer.';
  }
  if (!values.digestType || !isValidInteger(values.digestType)) {
    errors.digestType = 'Digest type must be a valid integer.';
  }
  if (!values.digest) {
    errors.digest = 'Digest is required.';
  } else if (!/^[0-9a-fA-F]+$/.test(values.digest)) {
    errors.digest = 'Digest should be a hex string.';
  }

  // Advanced fields are optional
  if (values.maxSigLife && !isValidInteger(values.maxSigLife)) {
    errors.maxSigLife = 'Max signature life must be a valid integer.';
  }

  return errors;
}

// --- Registration Form ---

export interface RegistrationFormValues {
  domain: string;
  confirmDomain: string;
}

export function validateRegistrationConfirm(values: RegistrationFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (values.confirmDomain !== values.domain) {
    errors.confirmDomain = 'Type the exact domain name to confirm registration.';
  }
  return errors;
}

// --- Renewal Form ---

export interface RenewalFormValues {
  domain: string;
  confirmDomain: string;
  costCents: number;
}

export function validateRenewalConfirm(values: RenewalFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (values.confirmDomain !== values.domain) {
    errors.confirmDomain = 'Type the exact domain name to confirm renewal.';
  }
  return errors;
}

// --- Transfer Form ---

export interface TransferFormValues {
  domain: string;
  authCode: string;
  confirmDomain: string;
}

export function validateTransferForm(values: TransferFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.domain) {
    errors.domain = 'Domain is required.';
  }
  if (!values.authCode) {
    errors.authCode = 'Authorization code is required.';
  }
  if (values.confirmDomain !== values.domain) {
    errors.confirmDomain = 'Type the exact domain name to confirm transfer.';
  }
  return errors;
}

// --- SSL Export Form ---

export interface SslExportFormValues {
  exportPath: string;
}

export function validateSslExportForm(values: SslExportFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.exportPath) {
    errors.exportPath = 'Export directory path is required.';
  }
  return errors;
}

// --- Price Conversion ---

/**
 * Convert a price string (e.g., "9.73") to integer cents.
 * Never use binary floating point for money.
 */
export function priceStringToCents(priceStr: string): number | undefined {
  const cleaned = priceStr.replace(/[^0-9.]/g, '');
  if (!cleaned || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return undefined;
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

export function buildAutoRenewReview(domains: string[], previousState: Record<string, boolean>, newState: 'on' | 'off'): ReviewSnapshot {
  return {
    operation: `Auto-renew ${newState}`,
    target: domains.join(', '),
    classification: 'mutating',
    fields: domains.map(d => ({
      label: d,
      value: `${previousState[d] ? 'on' : 'off'} → ${newState}`,
    })),
    expectedInvalidations: domains.map(d => `domain:${d}`),
  };
}

// --- Helpers ---

function isValidIP(value: string): boolean {
  return isIP(value) !== 0;
}

function isValidIPv4(value: string): boolean {
  return isIP(value) === 4;
}

function isValidIPv6(value: string): boolean {
  return isIP(value) === 6;
}

function isValidHostname(value: string): boolean {
  if (!value || value.length > 253) return false;
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(value);
}

function isValidInteger(value: string): boolean {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && String(parsed) === value.trim();
}
