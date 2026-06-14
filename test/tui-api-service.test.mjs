/**
 * Integration tests for TUI API service
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ApiClient } from '../dist/lib/api-client.js';
import { TuiApiService } from '../dist/tui/services/api.js';
import { fetch, MockAgent } from 'undici';

describe('TUI API Service Integration', () => {
  it('normalizes domain list response', async () => {
    const mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    try {
      const mockPool = mockAgent.get('https://api.porkbun.com');

      mockPool.intercept({
        path: '/api/json/v3/domain/listAll',
        method: 'GET',
      }).reply(200, {
        status: 'SUCCESS',
        domains: [
          {
            domain: 'example.com',
            status: 'ACTIVE',
            tld: 'com',
            expireDate: '2025-12-31',
            autoRenew: 1,
            apiAccess: 1,
            securityLock: 1,
            whoisPrivacy: 1,
            notLocal: 0,
          },
        ],
        count: 1,
      });

      const client = new ApiClient({
        apiKey: 'test-key',
        secretApiKey: 'test-secret',
        fetch: withDispatcher(mockAgent),
      });
      const service = new TuiApiService(client);

      const result = await service.getDomains({});

      assert.strictEqual(result.status, 'loaded');
      assert.ok(result.data);
      assert.strictEqual(result.data.domains.length, 1);
      assert.strictEqual(result.data.domains[0].domain, 'example.com');
      assert.strictEqual(result.data.domains[0].autoRenew, true);
      assert.strictEqual(result.data.domains[0].apiAccess, true);
      assert.strictEqual(result.data.count, 1);
    } finally {
      await mockAgent.close();
    }
  });

  it('normalizes DNS record response', async () => {
    const mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    try {
      const mockPool = mockAgent.get('https://api.porkbun.com');

      mockPool.intercept({
        path: '/api/json/v3/dns/retrieve/example.com',
        method: 'GET',
      }).reply(200, {
        status: 'SUCCESS',
        records: [
          {
            id: '123',
            name: 'www',
            type: 'A',
            content: '192.168.1.1',
            ttl: '300',
            prio: '0',
            notes: 'Test record',
          },
        ],
      });

      const client = new ApiClient({
        apiKey: 'test-key',
        secretApiKey: 'test-secret',
        fetch: withDispatcher(mockAgent),
      });
      const service = new TuiApiService(client);

      const result = await service.getDnsRecords('example.com');

      assert.strictEqual(result.status, 'loaded');
      assert.ok(result.data);
      assert.strictEqual(result.data.length, 1);
      assert.strictEqual(result.data[0].id, '123');
      assert.strictEqual(result.data[0].name, 'www');
      assert.strictEqual(result.data[0].type, 'A');
      assert.strictEqual(result.data[0].ttl, 300);
    } finally {
      await mockAgent.close();
    }
  });

  it('handles API errors gracefully', async () => {
    const mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    try {
      const mockPool = mockAgent.get('https://api.porkbun.com');

      mockPool.intercept({
        path: '/api/json/v3/domain/get/notfound.com',
        method: 'GET',
      }).reply(404, {
        status: 'ERROR',
        message: 'Domain not found',
      });

      const client = new ApiClient({
        apiKey: 'test-key',
        secretApiKey: 'test-secret',
        fetch: withDispatcher(mockAgent),
      });
      const service = new TuiApiService(client);

      const result = await service.getDomain('notfound.com');

      assert.strictEqual(result.status, 'error');
      assert.ok(result.error);
    } finally {
      await mockAgent.close();
    }
  });

  it('normalizes pricing response', async () => {
    const mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    try {
      const mockPool = mockAgent.get('https://api.porkbun.com');

      mockPool.intercept({
        path: '/api/json/v3/pricing/get',
        method: 'POST',
      }).reply(200, {
        status: 'SUCCESS',
        pricing: {
          com: { registration: '9.68', renewal: '9.68', transfer: '9.68' },
          net: { registration: '9.68', renewal: '9.68', transfer: '9.68' },
          'co.uk': { registration: '7.50', renewal: '7.50', transfer: '7.50' },
        },
      }).persist();

      const client = new ApiClient({
        apiKey: 'test-key',
        secretApiKey: 'test-secret',
        fetch: withDispatcher(mockAgent),
      });
      const service = new TuiApiService(client);

      const result = await service.getPricing();

      assert.strictEqual(result.status, 'loaded');
      assert.ok(result.data);
      assert.strictEqual(result.data.get('com')?.registration, '9.68');
      assert.strictEqual(result.data.get('com')?.renewal, '9.68');
      assert.strictEqual(result.data.get('com')?.transfer, '9.68');

      const tldPrice = await service.getTldPrice('example.com', 'renewal');
      assert.strictEqual(tldPrice, '9.68');

      // Multi-label TLD: example.co.uk must resolve to the 'co.uk' key,
      // not the bare 'uk' suffix.
      const multiLabel = await service.getTldPrice('example.co.uk', 'renewal');
      assert.strictEqual(multiLabel, '7.50');

      const unknownTld = await service.getTldPrice('example.zzz', 'renewal');
      assert.strictEqual(unknownTld, undefined);
    } finally {
      await mockAgent.close();
    }
  });

  it('reads per-domain renewal and transfer prices from the checkDomain response', async () => {
    const mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    try {
      const mockPool = mockAgent.get('https://api.porkbun.com');

      mockPool.intercept({
        path: '/api/json/v3/domain/checkDomain/example.com',
        method: 'POST',
      }).reply(200, {
        status: 'SUCCESS',
        response: {
          avail: 'no',
          price: '12.34',
          additional: {
            renewal: { price: '11.11' },
            transfer: { price: '9.99' },
          },
        },
      }).persist();

      const client = new ApiClient({
        apiKey: 'test-key',
        secretApiKey: 'test-secret',
        fetch: withDispatcher(mockAgent),
      });
      const service = new TuiApiService(client);

      const renewal = await service.getDomainPriceFromCheck('example.com', 'renewal');
      assert.strictEqual(renewal, '11.11');
      const transfer = await service.getDomainPriceFromCheck('example.com', 'transfer');
      assert.strictEqual(transfer, '9.99');
    } finally {
      await mockAgent.close();
    }
  });

  it('normalizes account balance', async () => {
    const mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    try {
      const mockPool = mockAgent.get('https://api.porkbun.com');

      mockPool.intercept({
        path: '/api/json/v3/account/balance',
        method: 'GET',
      }).reply(200, {
        status: 'SUCCESS',
        balance: 12345,
      });

      const client = new ApiClient({
        apiKey: 'test-key',
        secretApiKey: 'test-secret',
        fetch: withDispatcher(mockAgent),
      });
      const service = new TuiApiService(client);

      const result = await service.getBalance();

      assert.strictEqual(result.status, 'loaded');
      assert.ok(result.data);
      assert.strictEqual(result.data.balanceCents, 12345);
      assert.ok(result.data.displayBalance);
    } finally {
      await mockAgent.close();
    }
  });
});

function withDispatcher(dispatcher) {
  return (input, init) => fetch(input, { ...init, dispatcher });
}
