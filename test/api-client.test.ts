import { describe, it, expect } from "vitest";
import { fetch, MockAgent } from "undici";
import {
  ApiClient,
  deterministicIdempotencyKey,
  fillPath,
  redactUrl,
  validateBaseUrl,
} from "../src/lib/api-client.js";
import { CliError } from "../src/lib/errors.js";
import { requireOperation } from "../src/lib/operations.js";

describe("api-client", () => {
  it("client sends body auth and deterministic idempotency key for mutations", async () => {
    const mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    try {
      const pool = mockAgent.get("https://api.porkbun.com");
      let seen;
      pool
        .intercept({ method: "POST", path: "/api/json/v3/domain/create/example.com" })
        .reply(200, (options) => {
          seen = options;
          return { status: "SUCCESS", domain: "example.com", orderId: 123 };
        });

      const client = new ApiClient({
        apiKey: "pk",
        secretApiKey: "sk",
        fetch: withDispatcher(mockAgent),
      });
      const result = await client.request(requireOperation("domainCreate"), {
        pathParams: { domain: "example.com" },
        body: { cost: 973, agreeToTerms: "yes" },
      });

      expect(result).toEqual({ status: "SUCCESS", domain: "example.com", orderId: 123 });
      expect(headerValue(seen.headers, "idempotency-key")).toEqual(
        deterministicIdempotencyKey(
          requireOperation("domainCreate"),
          "/domain/create/example.com",
          { cost: 973, agreeToTerms: "yes" },
        ),
      );
      expect(JSON.parse(seen.body)).toEqual({
        cost: 973,
        agreeToTerms: "yes",
        apikey: "pk",
        secretapikey: "sk",
      });
    } finally {
      await mockAgent.close();
    }
  });

  it("client maps rate-limit responses to structured retryable errors", async () => {
    const mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    try {
      const pool = mockAgent.get("https://api.porkbun.com");
      pool.intercept({ method: "GET", path: "/api/json/v3/domain/listAll" }).reply(429, {
        status: "ERROR",
        code: "RATE_LIMIT_EXCEEDED",
        message: "Rate limit exceeded.",
      });

      const client = new ApiClient({
        apiKey: "pk",
        secretApiKey: "sk",
        fetch: withDispatcher(mockAgent),
      });
      await expect(() => client.request(requireOperation("getDomains"))).rejects.toSatisfy(
        (error: unknown) => {
          expect(error).toBeInstanceOf(CliError);
          const cliErr = error as CliError;
          expect(cliErr.kind).toEqual("rate_limit");
          expect(cliErr.retryable).toEqual(true);
          expect(cliErr.exitCode).toEqual(5);
          return true;
        },
      );
    } finally {
      await mockAgent.close();
    }
  });

  it("client refuses insecure or non-Porkbun credential destinations", () => {
    expect(validateBaseUrl("http://127.0.0.1:8080/api")).toEqual("http://127.0.0.1:8080/api");
    expect(() => validateBaseUrl("http://example.com/api")).toThrow(/must use HTTPS/);
    expect(() => validateBaseUrl("https://example.com/api", true)).toThrow(
      /Refusing to send Porkbun credentials/,
    );
    expect(validateBaseUrl("https://api.porkbun.com/api/json/v3", true)).toEqual(
      "https://api.porkbun.com/api/json/v3",
    );
  });

  it("request URLs redact sensitive query parameters", () => {
    const value = redactUrl("https://api.porkbun.com/api?requestToken=secret&domain=example.com");
    const url = new URL(value);
    expect(url.searchParams.get("requestToken")).toEqual("[REDACTED]");
    expect(url.searchParams.get("domain")).toEqual("example.com");
  });

  it("path parameters are encoded without regex backtracking", () => {
    expect(fillPath("/dns/edit/{domain}/{id}", { domain: "example.com", id: "record/1" })).toEqual(
      "/dns/edit/example.com/record%2F1",
    );
    expect(() => fillPath("/dns/edit/{domain}/{id}", { domain: "example.com" })).toThrow(
      /Missing required path parameter: id/,
    );
    expect(fillPath("/literal/{}/unfinished/{domain", {})).toEqual(
      "/literal/{}/unfinished/{domain",
    );

    const adversarialPath = `{${"{".repeat(100_000)}}`;
    expect(() => fillPath(adversarialPath, {})).toThrow(CliError);
  });
});

function headerValue(headers: Record<string, string> | Headers, name: string): string | undefined {
  if (typeof (headers as Headers)?.get === "function") {
    return (headers as Headers).get(name) ?? undefined;
  }
  const entry = Object.entries(headers as Record<string, string>).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );
  return entry?.[1];
}

function withDispatcher(dispatcher: any) {
  return (input: string, init: RequestInit) => fetch(input, { ...init, dispatcher });
}
