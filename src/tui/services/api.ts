/**
 * TuiApiService - API-facing services for the TUI.
 * Depends on ApiClient and OperationDefinition, not Commander.
 */
import type { ApiClient } from '../../lib/api-client.js';
import { requireOperation } from '../../lib/operations.js';
import { stripParentDomain } from '../forms/validators.js';
import type {
  NormalizedDomain,
  NormalizedDnsRecord,
  NormalizedGlueRecord,
  NormalizedForward,
  NormalizedDnssecRecord,
  NormalizedTransfer,
  NormalizedAccountBalance,
  NormalizedApiSettings,
  NormalizedSslBundle,
  ResourceState,
  DomainQuery,
} from '../types.js';

export class TuiApiService {
  constructor(private client: ApiClient) {}

  // --- Auth ---

  async ping(signal?: AbortSignal): Promise<ResourceState<{ yourIp: string; credentialsValid: boolean }>> {
    try {
      const data = await this.client.request(requireOperation('pingGet'));
      const record = asRecord(data);
      return {
        status: 'loaded',
        data: {
          yourIp: String(record.yourIp ?? ''),
          credentialsValid: record.credentialsValid === true || record.credentialsValid === 'true',
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      return errorState(error);
    }
  }

  // --- Domains ---

  async getDomains(query: DomainQuery = {}, signal?: AbortSignal): Promise<ResourceState<{ domains: NormalizedDomain[]; count: number }>> {
    try {
      const data = await this.client.request(requireOperation('getDomains'), {
        query: {
          start: query.start,
          includeLabels: query.includeLabels ? 'yes' : undefined,
          domain: query.domain,
          nameContains: query.nameContains,
          expiringWithinDays: query.expiringWithinDays,
          tlds: query.tlds,
          autoRenew: query.autoRenew === true ? 'yes' : query.autoRenew === false ? 'no' : undefined,
          apiAccess: query.apiAccess === true ? 'yes' : query.apiAccess === false ? 'no' : undefined,
          sortName: query.sortName,
          sortDirection: query.sortDirection,
        },
      });
      const record = asRecord(data);
      const domains = asArray(record.domains).map(normalizeDomain);
      const count = typeof record.count === 'number' ? record.count : domains.length;
      return {
        status: 'loaded',
        data: { domains, count },
        timestamp: Date.now(),
      };
    } catch (error) {
      return errorState(error);
    }
  }

  async getDomain(domain: string): Promise<ResourceState<NormalizedDomain>> {
    try {
      const data = await this.client.request(requireOperation('getDomain'), {
        pathParams: { domain },
        query: { includeLabels: 'yes' },
      });
      const record = asRecord(data);
      const domainData = asRecord(record.domain ?? data);
      return {
        status: 'loaded',
        data: normalizeDomain(domainData),
        timestamp: Date.now(),
      };
    } catch (error) {
      return errorState(error);
    }
  }

  // --- DNS Records ---

  async getDnsRecords(domain: string): Promise<ResourceState<NormalizedDnsRecord[]>> {
    try {
      const data = await this.client.request(requireOperation('getDnsRecords'), {
        pathParams: { domain },
      });
      const record = asRecord(data);
      const records = asArray(record.records).map(normalizeDnsRecord);
      return { status: 'loaded', data: records, timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }

  async createDnsRecord(domain: string, body: Record<string, unknown>): Promise<ResourceState<Record<string, unknown>>> {
    try {
      const data = await this.client.request(requireOperation('dnsCreate'), {
        pathParams: { domain },
        body,
      });
      return { status: 'loaded', data: asRecord(data), timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }

  async editDnsRecord(domain: string, id: string, body: Record<string, unknown>): Promise<ResourceState<Record<string, unknown>>> {
    try {
      const data = await this.client.request(requireOperation('dnsEdit'), {
        pathParams: { domain, id },
        body,
      });
      return { status: 'loaded', data: asRecord(data), timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }

  async deleteDnsRecord(domain: string, id: string): Promise<ResourceState<Record<string, unknown>>> {
    try {
      const data = await this.client.request(requireOperation('dnsDelete'), {
        pathParams: { domain, id },
      });
      return { status: 'loaded', data: asRecord(data), timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }

  // --- Nameservers ---

  async getNameservers(domain: string): Promise<ResourceState<string[]>> {
    try {
      const data = await this.client.request(requireOperation('getDomainNs'), {
        pathParams: { domain },
      });
      const record = asRecord(data);
      const ns = asStringArray(record.ns);
      return { status: 'loaded', data: ns, timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }

  async updateNameservers(domain: string, ns: string[]): Promise<ResourceState<Record<string, unknown>>> {
    try {
      const data = await this.client.request(requireOperation('domainUpdateNs'), {
        pathParams: { domain },
        body: { ns },
      });
      return { status: 'loaded', data: asRecord(data), timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }

  // --- Glue Records ---

  async getGlueRecords(domain: string): Promise<ResourceState<NormalizedGlueRecord[]>> {
    try {
      const data = await this.client.request(requireOperation('getDomainGlue'), {
        pathParams: { domain },
      });
      const record = asRecord(data);
      const records = normalizeGlueResponse(record, domain);
      return { status: 'loaded', data: records, timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }

  async createGlueRecord(domain: string, subdomain: string, ips: string[]): Promise<ResourceState<Record<string, unknown>>> {
    try {
      const data = await this.client.request(requireOperation('domainCreateGlue'), {
        pathParams: { domain, subdomain },
        body: { ips },
      });
      return { status: 'loaded', data: asRecord(data), timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }

  async updateGlueRecord(domain: string, subdomain: string, ips: string[]): Promise<ResourceState<Record<string, unknown>>> {
    try {
      const data = await this.client.request(requireOperation('domainUpdateGlue'), {
        pathParams: { domain, subdomain },
        body: { ips },
      });
      return { status: 'loaded', data: asRecord(data), timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }

  async deleteGlueRecord(domain: string, subdomain: string): Promise<ResourceState<Record<string, unknown>>> {
    try {
      const data = await this.client.request(requireOperation('domainDeleteGlue'), {
        pathParams: { domain, subdomain },
      });
      return { status: 'loaded', data: asRecord(data), timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }

  // --- URL Forwards ---

  async getUrlForwards(domain: string): Promise<ResourceState<NormalizedForward[]>> {
    try {
      const data = await this.client.request(requireOperation('getDomainUrlForwarding'), {
        pathParams: { domain },
      });
      const record = asRecord(data);
      const forwards = asArray(record.forwards).map(normalizeForward);
      return { status: 'loaded', data: forwards, timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }

  async addUrlForward(domain: string, body: Record<string, unknown>): Promise<ResourceState<Record<string, unknown>>> {
    try {
      const data = await this.client.request(requireOperation('domainAddUrlForward'), {
        pathParams: { domain },
        body,
      });
      return { status: 'loaded', data: asRecord(data), timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }

  async deleteUrlForward(domain: string, id: string): Promise<ResourceState<Record<string, unknown>>> {
    try {
      const data = await this.client.request(requireOperation('domainDeleteUrlForward'), {
        pathParams: { domain, id },
      });
      return { status: 'loaded', data: asRecord(data), timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }

  // --- DNSSEC ---

  async getDnssecRecords(domain: string): Promise<ResourceState<NormalizedDnssecRecord[]>> {
    try {
      const data = await this.client.request(requireOperation('getDnssecRecords'), {
        pathParams: { domain },
      });
      const record = asRecord(data);
      const records = normalizeDnssecResponse(record);
      return { status: 'loaded', data: records, timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }

  async createDnssecRecord(domain: string, body: Record<string, unknown>): Promise<ResourceState<Record<string, unknown>>> {
    try {
      const data = await this.client.request(requireOperation('dnsCreateDnssecRecord'), {
        pathParams: { domain },
        body,
      });
      return { status: 'loaded', data: asRecord(data), timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }

  async deleteDnssecRecord(domain: string, keytag: string): Promise<ResourceState<Record<string, unknown>>> {
    try {
      const data = await this.client.request(requireOperation('dnsDeleteDnssecRecord'), {
        pathParams: { domain, keytag },
      });
      return { status: 'loaded', data: asRecord(data), timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }

  // --- SSL ---

  async getSslBundle(domain: string): Promise<ResourceState<NormalizedSslBundle>> {
    try {
      const data = await this.client.request(requireOperation('getSslRetrieve'), {
        pathParams: { domain },
      });
      const record = asRecord(data);
      return {
        status: 'loaded',
        data: {
          certificateChain: typeof record.certificatechain === 'string' ? record.certificatechain : undefined,
          publicKey: typeof record.publickey === 'string' ? record.publickey : undefined,
          privateKey: typeof record.privatekey === 'string' ? record.privatekey : undefined,
          raw: record,
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      return errorState(error);
    }
  }

  // --- Auto-renew ---

  async updateAutoRenew(domain: string, status: 'on' | 'off', domains?: string[]): Promise<ResourceState<Record<string, unknown>>> {
    try {
      const data = await this.client.request(requireOperation('domainUpdateAutoRenew'), {
        pathParams: { domain },
        body: { status, domains },
      });
      return { status: 'loaded', data: asRecord(data), timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }

  // --- Domain Check / Availability ---

  async checkDomain(domain: string): Promise<ResourceState<Record<string, unknown>>> {
    try {
      const data = await this.client.request(requireOperation('domainCheckDomain'), {
        pathParams: { domain },
      });
      return { status: 'loaded', data: asRecord(data), timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }

  /**
   * Read the per-domain price for a given action from the checkDomain
   * response. Porkbun returns additional.renewal.price and
   * additional.transfer.price for the specific domain, which is the only
   * correct source for premium and other non-default-priced domains
   * (TLD-level /pricing/get is a fallback only).
   */
  async getDomainPriceFromCheck(domain: string, kind: 'renewal' | 'transfer'): Promise<string | undefined> {
    const result = await this.checkDomain(domain);
    if (result.status !== 'loaded' || !result.data) return undefined;
    const response = asRecord(result.data.response);
    // additional has at most two known keys (renewal / transfer); iterate
    // via Object.entries rather than bracket access on the dynamic kind.
    const additional = asRecord(response.additional);
    for (const [k, value] of Object.entries(additional)) {
      if (k !== kind) continue;
      const bucket = asRecord(value);
      if (typeof bucket.price === 'string') return bucket.price;
    }
    return undefined;
  }

  // --- Pricing ---

  async getPricing(): Promise<ResourceState<Map<string, { registration: string; renewal: string; transfer: string }>>> {
    try {
      const data = await this.client.request(requireOperation('getPricing'));
      const record = asRecord(data);
      const pricing = asRecord(record.pricing);
      const result = new Map<string, { registration: string; renewal: string; transfer: string }>();
      for (const [tld, entry] of Object.entries(pricing)) {
        const r = asRecord(entry);
        result.set(tld, {
          registration: String(r.registration ?? ''),
          renewal: String(r.renewal ?? ''),
          transfer: String(r.transfer ?? ''),
        });
      }
      return { status: 'loaded', data: result, timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }

  /**
   * Look up a price string for a domain from the pricing endpoint.
   * Accepts a full domain like "example.co.uk" and resolves the longest
   * matching TLD suffix against the pricing data, so multi-label TLDs
   * (co.uk, com.au, co.jp, ...) hit the right key.
   *
   * Returns undefined when no matching TLD is present or the request
   * failed. Callers that need the domain-specific price (e.g. premium
   * domains) should prefer the per-domain checkDomain response.
   */
  async getTldPrice(domain: string, kind: 'registration' | 'renewal' | 'transfer'): Promise<string | undefined> {
    const result = await this.getPricing();
    if (result.status !== 'loaded' || !result.data) return undefined;
    const labels = domain.toLowerCase().replace(/^\.+/, '').split('.').filter(Boolean);
    if (labels.length < 2) return undefined;
    // Walk the TLD suffix from longest to shortest, capped at 3 labels
    // (covers virtually every public TLD: com, co.uk, com.au, co.jp, ...).
    const maxSuffix = Math.min(labels.length - 1, 3);
    for (let suffixLen = maxSuffix; suffixLen >= 1; suffixLen--) {
      const candidate = labels.slice(-suffixLen).join('.');
      const entry = result.data.get(candidate);
      if (!entry) continue;
      // entry has three fixed keys; switch on kind rather than
      // bracket access.
      const price =
        kind === 'registration' ? entry.registration :
        kind === 'renewal' ? entry.renewal :
        entry.transfer;
      if (price) return price;
    }
    return undefined;
  }

  // --- Registration ---

  async registerDomain(domain: string, cost: number, agreeToTerms: string): Promise<ResourceState<Record<string, unknown>>> {
    try {
      const data = await this.client.request(requireOperation('domainCreate'), {
        pathParams: { domain },
        body: { cost, agreeToTerms },
      });
      return { status: 'loaded', data: asRecord(data), timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }

  // --- Renewal ---

  async renewDomain(domain: string, cost: number): Promise<ResourceState<Record<string, unknown>>> {
    try {
      const data = await this.client.request(requireOperation('domainRenew'), {
        pathParams: { domain },
        body: { cost },
      });
      return { status: 'loaded', data: asRecord(data), timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }

  // --- Transfers ---

  async listTransfers(): Promise<ResourceState<NormalizedTransfer[]>> {
    try {
      const data = await this.client.request(requireOperation('listTransfersGet'));
      const record = asRecord(data);
      const transfers = asArray(record.transfers).map(normalizeTransfer);
      return { status: 'loaded', data: transfers, timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }

  async getTransfer(domain: string): Promise<ResourceState<Record<string, unknown>>> {
    try {
      const data = await this.client.request(requireOperation('getTransferGet'), {
        pathParams: { domain },
      });
      return { status: 'loaded', data: asRecord(data), timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }

  async transferDomain(domain: string, cost: number, authCode: string): Promise<ResourceState<Record<string, unknown>>> {
    try {
      const data = await this.client.request(requireOperation('transferDomain'), {
        pathParams: { domain },
        body: { cost, authCode },
      });
      return { status: 'loaded', data: asRecord(data), timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }

  // --- Account ---

  async getBalance(): Promise<ResourceState<NormalizedAccountBalance>> {
    try {
      const data = await this.client.request(requireOperation('getBalance'));
      const record = asRecord(data);
      const balance = typeof record.balance === 'number' ? record.balance : 0;
      const display = typeof record.display === 'string' ? record.display : `$${(balance / 100).toFixed(2)}`;
      return {
        status: 'loaded',
        data: { balanceCents: balance, displayBalance: display, raw: record },
        timestamp: Date.now(),
      };
    } catch (error) {
      return errorState(error);
    }
  }

  async getApiSettings(): Promise<ResourceState<NormalizedApiSettings>> {
    try {
      const data = await this.client.request(requireOperation('getApiSettings'));
      const record = asRecord(data);
      const monthlySpend = typeof record.monthlySpend === 'number' ? record.monthlySpend : undefined;
      return {
        status: 'loaded',
        data: {
          monthlySpendCents: monthlySpend,
          settings: asRecord(record.settings ?? record),
          raw: record,
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      return errorState(error);
    }
  }

  // --- Marketplace ---

  async listMarketplaceListings(query?: Record<string, unknown>): Promise<ResourceState<Record<string, unknown>>> {
    try {
      const data = await this.client.request(requireOperation('listMarketplaceListingsGet'), {
        query,
      });
      return { status: 'loaded', data: asRecord(data), timestamp: Date.now() };
    } catch (error) {
      return errorState(error);
    }
  }
}

// --- Normalizers ---

function normalizeDomain(raw: Record<string, unknown>): NormalizedDomain {
  return {
    domain: String(raw.domain ?? ''),
    status: String(raw.status ?? ''),
    tld: String(raw.tld ?? ''),
    createDate: typeof raw.createDate === 'string' ? raw.createDate : undefined,
    expireDate: typeof raw.expireDate === 'string' ? raw.expireDate : undefined,
    securityLock: toBool(raw.securityLock),
    whoisPrivacy: toBool(raw.whoisPrivacy),
    autoRenew: toBool(raw.autoRenew),
    apiAccess: toBool(raw.apiAccess),
    notLocal: toBool(raw.notLocal),
    labels: normalizeLabels(raw.labels),
    raw,
  };
}

function normalizeDnsRecord(raw: Record<string, unknown>): NormalizedDnsRecord {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    type: String(raw.type ?? ''),
    content: String(raw.content ?? ''),
    ttl: raw.ttl !== undefined && raw.ttl !== null ? parseInt(String(raw.ttl), 10) : undefined,
    prio: raw.prio !== undefined && raw.prio !== null ? parseInt(String(raw.prio), 10) : undefined,
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
    raw,
  };
}

function normalizeGlueResponse(record: Record<string, unknown>, parentDomain: string): NormalizedGlueRecord[] {
  const hosts = record.hosts ?? record.records;
  if (!hosts) return [];

  // Handle tuple format: [hostname, {v4: [], v6: []}]
  if (Array.isArray(hosts)) {
    return hosts.map((entry) => {
      if (Array.isArray(entry) && entry.length >= 2) {
        const hostname = String(entry[0] ?? '');
        const data = asRecord(entry[1] ?? {});
        const ipv4 = asStringArray(data.v4 ?? data.ipv4);
        const ipv6 = asStringArray(data.v6 ?? data.ipv6);
        return {
          hostname,
          subdomain: stripParentDomain(hostname, parentDomain),
          ipv4,
          ipv6,
          ips: [...ipv4, ...ipv6],
          raw: { hostname, ...data },
        };
      }
      // Handle object format
      const r = asRecord(entry);
      const subdomain = String(r.subdomain ?? '');
      const ips = asArray(r.ips).map(String);
      return {
        hostname: subdomain ? `${subdomain}.${parentDomain}` : parentDomain,
        subdomain,
        ipv4: ips.filter(ip => !ip.includes(':')),
        ipv6: ips.filter(ip => ip.includes(':')),
        ips,
        raw: r,
      };
    });
  }

  return [];
}

function normalizeForward(raw: Record<string, unknown>): NormalizedForward {
  return {
    id: String(raw.id ?? ''),
    subdomain: String(raw.subdomain ?? ''),
    location: String(raw.location ?? ''),
    type: raw.type === 'permanent' ? 'permanent' : 'temporary',
    includePath: toBool(raw.includePath ?? raw.includePath),
    wildcard: toBool(raw.wildcard),
    raw,
  };
}

function normalizeDnssecResponse(record: Record<string, unknown>): NormalizedDnssecRecord[] {
  const records = record.records;
  if (!records) return [];

  // May be an object keyed by key tag or an array
  if (Array.isArray(records)) {
    return records.map(r => {
      const raw = asRecord(r);
      return {
        keyTag: parseInt(String(raw.keyTag ?? 0), 10),
        alg: parseInt(String(raw.alg ?? 0), 10),
        digestType: parseInt(String(raw.digestType ?? 0), 10),
        digest: String(raw.digest ?? ''),
        maxSigLife: raw.maxSigLife !== undefined ? parseInt(String(raw.maxSigLife), 10) : undefined,
        keyDataFlags: raw.keyDataFlags !== undefined ? parseInt(String(raw.keyDataFlags), 10) : undefined,
        keyDataProtocol: raw.keyDataProtocol !== undefined ? parseInt(String(raw.keyDataProtocol), 10) : undefined,
        keyDataAlgo: raw.keyDataAlgo !== undefined ? parseInt(String(raw.keyDataAlgo), 10) : undefined,
        keyDataPubKey: typeof raw.keyDataPubKey === 'string' ? raw.keyDataPubKey : undefined,
        raw,
      };
    }).sort((a, b) => a.keyTag - b.keyTag);
  }

  if (typeof records === 'object' && records !== null) {
    return Object.entries(records as Record<string, unknown>).map(([keyTag, data]) => {
      const raw = asRecord(data);
      return {
        keyTag: parseInt(keyTag, 10),
        alg: parseInt(String(raw.alg ?? 0), 10),
        digestType: parseInt(String(raw.digestType ?? 0), 10),
        digest: String(raw.digest ?? ''),
        raw,
      };
    }).sort((a, b) => a.keyTag - b.keyTag);
  }

  return [];
}

function normalizeTransfer(raw: Record<string, unknown>): NormalizedTransfer {
  return {
    domain: String(raw.domain ?? ''),
    status: String(raw.status ?? ''),
    statusDescription: typeof raw.statusDescription === 'string' ? raw.statusDescription : undefined,
    transferDate: typeof raw.transferDate === 'string' ? raw.transferDate : undefined,
    orderId: raw.orderId !== undefined ? String(raw.orderId) : undefined,
    raw,
  };
}

// --- Helpers ---

function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'yes' || value.toLowerCase() === 'on' || value.toLowerCase() === 'true';
  return false;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.filter(v => typeof v === 'object' && v !== null) as Array<Record<string, unknown>>;
  return [];
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return [];
}

function normalizeLabels(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'object' && value !== null) {
    return Object.keys(value as Record<string, unknown>);
  }
  return undefined;
}

function errorState(error: unknown): ResourceState<never> {
  const err = error instanceof Error ? error : new Error(String(error));
  return {
    status: 'error',
    error: err,
    timestamp: Date.now(),
    retryable: true,
  };
}
