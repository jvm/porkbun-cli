import { describe, it, expect } from "vitest";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { saveProfile, resolveCredentials, configPath } from "../src/lib/config.js";
import { normalizeForOutput, render, redact } from "../src/lib/output.js";

describe("config-output", () => {
  it("credentials resolve in flag, env, profile order and config is 0600", async () => {
    const dir = await mkdtemp(join(tmpdir(), "porkbun-cli-config-"));
    const previous = process.env.PORKBUN_CONFIG_FILE;
    process.env.PORKBUN_CONFIG_FILE = join(dir, "config.json");
    try {
      await saveProfile("default", "profile-key", "profile-secret");
      const mode = (await stat(configPath())).mode & 0o777;
      expect(mode).toEqual(0o600);

      expect(
        await resolveCredentials(
          {
            apiKey: "flag-key",
            secretApiKey: "flag-secret",
            env: {
              PORKBUN_API_KEY: "env-key",
              PORKBUN_SECRET_API_KEY: "env-secret",
            },
          },
          true,
        ),
      ).toEqual({
        apiKey: "flag-key",
        secretApiKey: "flag-secret",
        source: "flags",
      });

      expect(
        await resolveCredentials(
          {
            env: {
              PORKBUN_API_KEY: "env-key",
              PORKBUN_SECRET_API_KEY: "env-secret",
            },
          },
          true,
        ),
      ).toEqual({
        apiKey: "env-key",
        secretApiKey: "env-secret",
        source: "env",
      });

      expect(await resolveCredentials({ env: {} }, true)).toEqual({
        apiKey: "profile-key",
        secretApiKey: "profile-secret",
        source: "profile",
        profile: "default",
      });
    } finally {
      if (previous === undefined) delete process.env.PORKBUN_CONFIG_FILE;
      else process.env.PORKBUN_CONFIG_FILE = previous;
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("list output is bounded and field-selectable", () => {
    const data = normalizeForOutput(
      {
        status: "SUCCESS",
        domains: [
          { domain: "a.com", tld: "com" },
          { domain: "b.net", tld: "net" },
        ],
      },
      { listKey: "domains", limit: 1, offset: 1, fields: "domain" },
    );
    expect(data).toEqual({
      status: "SUCCESS",
      items: [{ domain: "b.net" }],
      total: 2,
      limit: 1,
      offset: 1,
    });
    expect(render(data, { output: "ndjson" })).toEqual('{"domain":"b.net"}\n');
  });

  it("redaction removes credentials from preview payloads", () => {
    expect(
      redact({ apikey: "pk", secret_api_key: "sk", nested: { requestToken: "token", ok: true } }),
    ).toEqual({
      apikey: "[REDACTED]",
      secret_api_key: "[REDACTED]",
      nested: { requestToken: "[REDACTED]", ok: true },
    });
  });

  it("field selection ignores prototype-reserved paths", () => {
    expect(normalizeForOutput({ safe: true }, { fields: "safe,__proto__.polluted" })).toEqual({
      safe: true,
    });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("profile names reject prototype-reserved values", async () => {
    await expect(() => saveProfile("__proto__", "key", "secret")).rejects.toThrow(
      /Profile names must be/,
    );
  });
});
