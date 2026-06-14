/**
 * Unit tests for TUI redaction and sanitization utilities
 */
import { describe, it, expect } from "vitest";
import {
  sanitizeString,
  truncateField,
  isSensitiveKey,
  redactReviewValue,
  redactErrorValue,
  redactObject,
} from "../src/tui/redact.js";

describe("TUI Redaction Utilities", () => {
  describe("sanitizeString", () => {
    it("removes control characters", () => {
      expect(sanitizeString("test\x00\x01\x02")).toBe("test");
    });

    it("removes ANSI escape sequences", () => {
      expect(sanitizeString("test\x1B[31mred\x1B[0m")).toBe("testred");
    });

    it("handles null and undefined", () => {
      expect(sanitizeString(null)).toBe("");
      expect(sanitizeString(undefined)).toBe("");
    });

    it("converts non-strings to strings", () => {
      expect(sanitizeString(123)).toBe("123");
      expect(sanitizeString(true)).toBe("true");
    });
  });

  describe("truncateField", () => {
    it("truncates long strings", () => {
      const long = "a".repeat(250);
      const result = truncateField(long);
      expect(result.length <= 200).toBeTruthy();
      expect(result.endsWith("…")).toBeTruthy();
    });

    it("does not truncate short strings", () => {
      const short = "test string";
      expect(truncateField(short)).toBe(short);
    });

    it("respects custom max length", () => {
      const result = truncateField("test string", 5);
      expect(result.length <= 5).toBeTruthy();
    });
  });

  describe("isSensitiveKey", () => {
    it("identifies API keys", () => {
      expect(isSensitiveKey("apikey")).toBe(true);
      expect(isSensitiveKey("api_key")).toBe(true);
      expect(isSensitiveKey("API_KEY")).toBe(true);
    });

    it("identifies secret keys", () => {
      expect(isSensitiveKey("secretapikey")).toBe(true);
      expect(isSensitiveKey("secret_api_key")).toBe(true);
    });

    it("identifies passwords", () => {
      expect(isSensitiveKey("password")).toBe(true);
      expect(isSensitiveKey("PASSWORD")).toBe(true);
    });

    it("identifies auth codes", () => {
      expect(isSensitiveKey("authcode")).toBe(true);
      expect(isSensitiveKey("auth_code")).toBe(true);
    });

    it("identifies private keys", () => {
      expect(isSensitiveKey("privatekey")).toBe(true);
      expect(isSensitiveKey("private_key")).toBe(true);
    });

    it("does not flag non-sensitive keys", () => {
      expect(isSensitiveKey("domain")).toBe(false);
      expect(isSensitiveKey("name")).toBe(false);
      expect(isSensitiveKey("content")).toBe(false);
    });
  });

  describe("redactReviewValue", () => {
    it("redacts sensitive keys", () => {
      expect(redactReviewValue("apikey", "secret123")).toBe("[REDACTED]");
      expect(redactReviewValue("password", "pass123")).toBe("[REDACTED]");
    });

    it("sanitizes non-sensitive values", () => {
      expect(redactReviewValue("domain", "test.com")).toBe("test.com");
    });
  });

  describe("redactErrorValue", () => {
    it("redacts API key patterns", () => {
      const error = "Error with pk1_live_abc123xyz in message";
      const result = redactErrorValue(error);
      expect(!result.includes("pk1_live_abc123xyz")).toBeTruthy();
      expect(result.includes("[REDACTED]")).toBeTruthy();
    });

    it("redacts secret key patterns", () => {
      const error = "Error with sk1_live_abc123xyz in message";
      const result = redactErrorValue(error);
      expect(!result.includes("sk1_live_abc123xyz")).toBeTruthy();
      expect(result.includes("[REDACTED]")).toBeTruthy();
    });

    it("redacts private key blocks", () => {
      const error = "Error with -----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----";
      const result = redactErrorValue(error);
      expect(!result.includes("PRIVATE KEY")).toBeTruthy();
      expect(result.includes("[REDACTED]")).toBeTruthy();
    });
  });

  describe("redactObject", () => {
    it("redacts sensitive fields in objects", () => {
      const obj = {
        domain: "example.com",
        apikey: "secret123",
        password: "pass123",
      };
      const result = redactObject(obj);
      expect(result.domain).toBe("example.com");
      expect(result.apikey).toBe("[REDACTED]");
      expect(result.password).toBe("[REDACTED]");
    });

    it("handles nested objects", () => {
      const obj = {
        domain: "example.com",
        credentials: {
          apikey: "secret123",
        },
      };
      const result = redactObject(obj);
      expect(result.domain).toBe("example.com");
      const credentials = result.credentials;
      expect(typeof credentials === "object" && credentials !== null).toBeTruthy();
      expect(credentials.apikey).toBe("[REDACTED]");
    });
  });
});
