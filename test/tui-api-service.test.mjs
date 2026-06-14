/**
 * Integration tests for TUI API service
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ApiClient } from '../dist/lib/api-client.js';
import { TuiApiService } from '../dist/tui/services/api.js';
import { MockAgent, setGlobalDispatcher } from 'undici';

describe('TUI API Service Integration', () => {
  it('normalizes domain list response', async () => {
    const mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
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

    mockAgent.close();
  });

  it('normalizes DNS record response', async () => {
    const mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
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

    mockAgent.close();
  });

  it('handles API errors gracefully', async () => {
    const mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
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
    });
    const service = new TuiApiService(client);

    const result = await service.getDomain('notfound.com');
    
    assert.strictEqual(result.status, 'error');
    assert.ok(result.error);

    mockAgent.close();
  });

  it('normalizes account balance', async () => {
    const mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
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
    });
    const service = new TuiApiService(client);

    const result = await service.getBalance();
    
    assert.strictEqual(result.status, 'loaded');
    assert.ok(result.data);
    assert.strictEqual(result.data.balanceCents, 12345);
    assert.ok(result.data.displayBalance);

    mockAgent.close();
  });
});
