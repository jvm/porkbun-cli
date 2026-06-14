/**
 * Integration tests for TUI API service
 */
import { describe, it, expect } from "vitest";
import { ApiClient } from "../src/lib/api-client.js";
import { TuiApiService } from "../src/tui/services/api.js";
import { fetch, MockAgent } from "undici";

describe("TUI API Service Integration", () => {
  it("normalizes domain list response", async () => {
    const mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    try {
      const mockPool = mockAgent.get("https://api.porkbun.com");

      mockPool
        .intercept({
          path: "/api/json/v3/domain/listAll",
          method: "GET",
        })
        .reply(200, {
          status: "SUCCESS",
          domains: [
            {
              domain: "example.com",
              status: "ACTIVE",
              tld: "com",
              expireDate: "2025-12-31",
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
        apiKey: "test-key",
        secretApiKey: "test-secret",
        fetch: withDispatcher(mockAgent),
      });
      const service = new TuiApiService(client);

      const result = await service.getDomains({});

      expect(result.status).toBe("loaded");
      expect(result.data).toBeTruthy();
      expect(result.data!.domains.length).toBe(1);
      expect(result.data!.domains[0]!.domain).toBe("example.com");
      expect(result.data!.domains[0]!.autoRenew).toBe(true);
      expect(result.data!.domains[0]!.apiAccess).toBe(true);
      expect(result.data!.count).toBe(1);
    } finally {
      await mockAgent.close();
    }
  });

  it("normalizes DNS record response", async () => {
    const mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    try {
      const mockPool = mockAgent.get("https://api.porkbun.com");

      mockPool
        .intercept({
          path: "/api/json/v3/dns/retrieve/example.com",
          method: "GET",
        })
        .reply(200, {
          status: "SUCCESS",
          records: [
            {
              id: "123",
              name: "www",
              type: "A",
              content: "192.168.1.1",
              ttl: "300",
              prio: "0",
              notes: "Test record",
            },
          ],
        });

      const client = new ApiClient({
        apiKey: "test-key",
        secretApiKey: "test-secret",
        fetch: withDispatcher(mockAgent),
      });
      const service = new TuiApiService(client);

      const result = await service.getDnsRecords("example.com");

      expect(result.status).toBe("loaded");
      expect(result.data).toBeTruthy();
      expect(result.data!.length).toBe(1);
      expect(result.data![0]!.id).toBe("123");
      expect(result.data![0]!.name).toBe("www");
      expect(result.data![0]!.type).toBe("A");
      expect(result.data![0]!.ttl).toBe(300);
    } finally {
      await mockAgent.close();
    }
  });

  it("handles API errors gracefully", async () => {
    const mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    try {
      const mockPool = mockAgent.get("https://api.porkbun.com");

      mockPool
        .intercept({
          path: "/api/json/v3/domain/get/notfound.com",
          method: "GET",
        })
        .reply(404, {
          status: "ERROR",
          message: "Domain not found",
        });

      const client = new ApiClient({
        apiKey: "test-key",
        secretApiKey: "test-secret",
        fetch: withDispatcher(mockAgent),
      });
      const service = new TuiApiService(client);

      const result = await service.getDomain("notfound.com");

      expect(result.status).toBe("error");
      expect(result.error).toBeTruthy();
    } finally {
      await mockAgent.close();
    }
  });

  it("normalizes pricing response", async () => {
    const mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    try {
      const mockPool = mockAgent.get("https://api.porkbun.com");

      mockPool
        .intercept({
          path: "/api/json/v3/pricing/get",
          method: "POST",
        })
        .reply(200, {
          status: "SUCCESS",
          pricing: {
            com: { registration: "9.68", renewal: "9.68", transfer: "9.68" },
            net: { registration: "9.68", renewal: "9.68", transfer: "9.68" },
            "co.uk": { registration: "7.50", renewal: "7.50", transfer: "7.50" },
          },
        })
        .persist();

      const client = new ApiClient({
        apiKey: "test-key",
        secretApiKey: "test-secret",
        fetch: withDispatcher(mockAgent),
      });
      const service = new TuiApiService(client);

      const result = await service.getPricing();

      expect(result.status).toBe("loaded");
      expect(result.data).toBeTruthy();
      expect(result.data!.get("com")?.registration).toBe("9.68");
      expect(result.data!.get("com")?.renewal).toBe("9.68");
      expect(result.data!.get("com")?.transfer).toBe("9.68");

      const tldPrice = await service.getTldPrice("example.com", "renewal");
      expect(tldPrice).toBe("9.68");

      // Multi-label TLD: example.co.uk must resolve to the 'co.uk' key,
      // not the bare 'uk' suffix.
      const multiLabel = await service.getTldPrice("example.co.uk", "renewal");
      expect(multiLabel).toBe("7.50");

      const unknownTld = await service.getTldPrice("example.zzz", "renewal");
      expect(unknownTld).toBeUndefined();
    } finally {
      await mockAgent.close();
    }
  });

  it("reads per-domain renewal and transfer prices from the checkDomain response", async () => {
    const mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    try {
      const mockPool = mockAgent.get("https://api.porkbun.com");

      mockPool
        .intercept({
          path: "/api/json/v3/domain/checkDomain/example.com",
          method: "POST",
        })
        .reply(200, {
          status: "SUCCESS",
          response: {
            avail: "no",
            price: "12.34",
            additional: {
              renewal: { price: "11.11" },
              transfer: { price: "9.99" },
            },
          },
        })
        .persist();

      const client = new ApiClient({
        apiKey: "test-key",
        secretApiKey: "test-secret",
        fetch: withDispatcher(mockAgent),
      });
      const service = new TuiApiService(client);

      const renewal = await service.getDomainPriceFromCheck("example.com", "renewal");
      expect(renewal).toBe("11.11");
      const transfer = await service.getDomainPriceFromCheck("example.com", "transfer");
      expect(transfer).toBe("9.99");
    } finally {
      await mockAgent.close();
    }
  });

  it("normalizes account balance", async () => {
    const mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    try {
      const mockPool = mockAgent.get("https://api.porkbun.com");

      mockPool
        .intercept({
          path: "/api/json/v3/account/balance",
          method: "GET",
        })
        .reply(200, {
          status: "SUCCESS",
          balance: 12345,
        });

      const client = new ApiClient({
        apiKey: "test-key",
        secretApiKey: "test-secret",
        fetch: withDispatcher(mockAgent),
      });
      const service = new TuiApiService(client);

      const result = await service.getBalance();

      expect(result.status).toBe("loaded");
      expect(result.data).toBeTruthy();
      expect(result.data!.balanceCents).toBe(12345);
      expect(result.data!.displayBalance).toBeTruthy();
    } finally {
      await mockAgent.close();
    }
  });
});

function withDispatcher(dispatcher: any) {
  return (input: string, init: RequestInit) => fetch(input, { ...init, dispatcher });
}
