import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { saveProfile, resolveCredentials, configPath } from "../dist/lib/config.js";
import { normalizeForOutput, render, redact } from "../dist/lib/output.js";

test("credentials resolve in flag, env, profile order and config is 0600", async () => {
  const dir = await mkdtemp(join(tmpdir(), "porkbun-cli-config-"));
  const previous = process.env.PORKBUN_CONFIG_FILE;
  process.env.PORKBUN_CONFIG_FILE = join(dir, "config.json");
  try {
    await saveProfile("default", "profile-key", "profile-secret");
    const mode = (await stat(configPath())).mode & 0o777;
    assert.equal(mode, 0o600);

    assert.deepEqual(
      await resolveCredentials(
        {
          apiKey: "flag-key",
          secretApiKey: "flag-secret",
          env: {
            PORKBUN_API_KEY: "env-key",
            PORKBUN_SECRET_API_KEY: "env-secret"
          }
        },
        true
      ),
      {
        apiKey: "flag-key",
        secretApiKey: "flag-secret",
        source: "flags"
      }
    );

    assert.deepEqual(
      await resolveCredentials(
        {
          env: {
            PORKBUN_API_KEY: "env-key",
            PORKBUN_SECRET_API_KEY: "env-secret"
          }
        },
        true
      ),
      {
        apiKey: "env-key",
        secretApiKey: "env-secret",
        source: "env"
      }
    );

    assert.deepEqual(await resolveCredentials({ env: {} }, true), {
      apiKey: "profile-key",
      secretApiKey: "profile-secret",
      source: "profile",
      profile: "default"
    });
  } finally {
    if (previous === undefined) delete process.env.PORKBUN_CONFIG_FILE;
    else process.env.PORKBUN_CONFIG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

test("list output is bounded and field-selectable", () => {
  const data = normalizeForOutput(
    { status: "SUCCESS", domains: [{ domain: "a.com", tld: "com" }, { domain: "b.net", tld: "net" }] },
    { listKey: "domains", limit: 1, offset: 1, fields: "domain" }
  );
  assert.deepEqual(data, {
    status: "SUCCESS",
    items: [{ domain: "b.net" }],
    total: 2,
    limit: 1,
    offset: 1
  });
  assert.equal(render(data, { output: "ndjson" }), "{\"domain\":\"b.net\"}\n");
});

test("redaction removes credentials from preview payloads", () => {
  assert.deepEqual(redact({ apikey: "pk", secret_api_key: "sk", nested: { requestToken: "token", ok: true } }), {
    apikey: "[REDACTED]",
    secret_api_key: "[REDACTED]",
    nested: { requestToken: "[REDACTED]", ok: true }
  });
});

test("field selection ignores prototype-reserved paths", () => {
  assert.deepEqual(normalizeForOutput({ safe: true }, { fields: "safe,__proto__.polluted" }), {
    safe: true
  });
  assert.equal({}.polluted, undefined);
});

test("profile names reject prototype-reserved values", async () => {
  await assert.rejects(() => saveProfile("__proto__", "key", "secret"), /Profile names must be/);
});
