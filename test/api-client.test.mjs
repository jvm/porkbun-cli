import assert from "node:assert/strict";
import test from "node:test";
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from "undici";
import { ApiClient, deterministicIdempotencyKey, redactUrl, validateBaseUrl } from "../dist/lib/api-client.js";
import { CliError } from "../dist/lib/errors.js";
import { requireOperation } from "../dist/lib/operations.js";

test("client sends body auth and deterministic idempotency key for mutations", async () => {
  const previous = getGlobalDispatcher();
  const mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
  try {
    const pool = mockAgent.get("https://api.porkbun.com");
    let seen;
    pool
      .intercept({ method: "POST", path: "/api/json/v3/domain/create/example.com" })
      .reply(200, (options) => {
        seen = options;
        return { status: "SUCCESS", domain: "example.com", orderId: 123 };
      });

    const client = new ApiClient({ apiKey: "pk", secretApiKey: "sk" });
    const result = await client.request(requireOperation("domainCreate"), {
      pathParams: { domain: "example.com" },
      body: { cost: 973, agreeToTerms: "yes" }
    });

    assert.deepEqual(result, { status: "SUCCESS", domain: "example.com", orderId: 123 });
    assert.equal(headerValue(seen.headers, "idempotency-key"), deterministicIdempotencyKey(
      requireOperation("domainCreate"),
      "/domain/create/example.com",
      { cost: 973, agreeToTerms: "yes" }
    ));
    assert.deepEqual(JSON.parse(seen.body), {
      cost: 973,
      agreeToTerms: "yes",
      apikey: "pk",
      secretapikey: "sk"
    });
  } finally {
    await mockAgent.close();
    setGlobalDispatcher(previous);
  }
});

test("client maps rate-limit responses to structured retryable errors", async () => {
  const previous = getGlobalDispatcher();
  const mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
  try {
    const pool = mockAgent.get("https://api.porkbun.com");
    pool
      .intercept({ method: "GET", path: "/api/json/v3/domain/listAll" })
      .reply(429, { status: "ERROR", code: "RATE_LIMIT_EXCEEDED", message: "Rate limit exceeded." });

    const client = new ApiClient({ apiKey: "pk", secretApiKey: "sk" });
    await assert.rejects(
      () => client.request(requireOperation("getDomains")),
      (error) => {
        assert.equal(error instanceof CliError, true);
        assert.equal(error.kind, "rate_limit");
        assert.equal(error.retryable, true);
        assert.equal(error.exitCode, 5);
        return true;
      }
    );
  } finally {
    await mockAgent.close();
    setGlobalDispatcher(previous);
  }
});

test("client refuses insecure or non-Porkbun credential destinations", () => {
  assert.equal(validateBaseUrl("http://127.0.0.1:8080/api"), "http://127.0.0.1:8080/api");
  assert.throws(() => validateBaseUrl("http://example.com/api"), /must use HTTPS/);
  assert.throws(
    () => validateBaseUrl("https://example.com/api", true),
    /Refusing to send Porkbun credentials/
  );
  assert.equal(
    validateBaseUrl("https://api.porkbun.com/api/json/v3", true),
    "https://api.porkbun.com/api/json/v3"
  );
});

test("request URLs redact sensitive query parameters", () => {
  const value = redactUrl("https://api.porkbun.com/api?requestToken=secret&domain=example.com");
  const url = new URL(value);
  assert.equal(url.searchParams.get("requestToken"), "[REDACTED]");
  assert.equal(url.searchParams.get("domain"), "example.com");
});

function headerValue(headers, name) {
  if (typeof headers?.get === "function") return headers.get(name);
  const entry = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1];
}
