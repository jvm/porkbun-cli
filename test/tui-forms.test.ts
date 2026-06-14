/**
 * Unit tests for TUI form validators
 */
import { describe, it, expect } from "vitest";
import {
  validateDnsRecordForm,
  validateNameserverForm,
  validateGlueForm,
  validateForwardForm,
  validateDnssecForm,
  buildDnsRecordPayload,
  stripParentDomain,
  priceStringToCents,
  centsToUsd,
} from "../src/tui/forms/validators.js";

describe("TUI Form Validators", () => {
  describe("validateDnsRecordForm", () => {
    it("validates required fields", () => {
      const errors = validateDnsRecordForm({
        type: "",
        name: "",
        content: "",
        ttl: "",
        prio: "",
        notes: "",
      });
      expect(errors.get("type")).toBeTruthy();
      expect(errors.get("content")).toBeTruthy();
    });

    it("validates A record IPv4", () => {
      const errors = validateDnsRecordForm({
        type: "A",
        name: "test",
        content: "invalid",
        ttl: "",
        prio: "",
        notes: "",
      });
      expect(errors.get("content")?.includes("IPv4")).toBeTruthy();
    });

    it("accepts valid A record", () => {
      const errors = validateDnsRecordForm({
        type: "A",
        name: "test",
        content: "192.168.1.1",
        ttl: "",
        prio: "",
        notes: "",
      });
      expect(errors.size).toBe(0);
    });

    it("validates AAAA record IPv6", () => {
      const errors = validateDnsRecordForm({
        type: "AAAA",
        name: "test",
        content: "invalid",
        ttl: "",
        prio: "",
        notes: "",
      });
      expect(errors.get("content")?.includes("IPv6")).toBeTruthy();
    });

    it("accepts valid AAAA record", () => {
      const errors = validateDnsRecordForm({
        type: "AAAA",
        name: "test",
        content: "2001:db8::1",
        ttl: "",
        prio: "",
        notes: "",
      });
      expect(errors.size).toBe(0);
    });

    it("validates TTL as integer", () => {
      const errors = validateDnsRecordForm({
        type: "A",
        name: "test",
        content: "1.2.3.4",
        ttl: "invalid",
        prio: "",
        notes: "",
      });
      expect(errors.get("ttl")).toBeTruthy();
    });

    it("accepts valid TTL", () => {
      const errors = validateDnsRecordForm({
        type: "A",
        name: "test",
        content: "1.2.3.4",
        ttl: "300",
        prio: "",
        notes: "",
      });
      expect(errors.get("ttl")).toBeUndefined();
    });
  });

  describe("validateNameserverForm", () => {
    it("requires at least one nameserver", () => {
      const errors = validateNameserverForm({ nameservers: [] });
      expect(errors.get("nameservers")).toBeTruthy();
    });

    it("validates hostname format", () => {
      const errors = validateNameserverForm({ nameservers: ["invalid..hostname"] });
      expect(errors.get("ns_0")).toBeTruthy();
    });

    it("accepts valid nameservers", () => {
      const errors = validateNameserverForm({
        nameservers: ["ns1.example.com", "ns2.example.com"],
      });
      expect(errors.size).toBe(0);
    });
  });

  describe("validateGlueForm", () => {
    it("validates IP addresses", () => {
      const errors = validateGlueForm({ subdomain: "ns1", ips: ["invalid"] });
      expect(errors.get("ip_0")).toBeTruthy();
    });

    it("accepts valid IPs", () => {
      const errors = validateGlueForm({
        subdomain: "ns1",
        ips: ["192.168.1.1", "2001:db8::1"],
      });
      expect(errors.size).toBe(0);
    });
  });

  describe("validateForwardForm", () => {
    it("requires http or https URLs", () => {
      const errors = validateForwardForm({
        subdomain: "",
        location: "ftp://example.com",
        type: "permanent",
        includePath: false,
        wildcard: false,
      });
      expect(errors.get("location")?.includes("http")).toBeTruthy();
    });

    it("accepts valid URLs", () => {
      const errors = validateForwardForm({
        subdomain: "www",
        location: "https://example.com",
        type: "permanent",
        includePath: false,
        wildcard: false,
      });
      expect(errors.size).toBe(0);
    });
  });

  describe("validateDnssecForm", () => {
    it("validates required fields", () => {
      const errors = validateDnssecForm({
        keyTag: "",
        alg: "",
        digestType: "",
        digest: "",
        maxSigLife: "",
        keyDataFlags: "",
        keyDataProtocol: "",
        keyDataAlgo: "",
        keyDataPubKey: "",
      });
      expect(errors.get("keyTag")).toBeTruthy();
      expect(errors.get("alg")).toBeTruthy();
      expect(errors.get("digestType")).toBeTruthy();
      expect(errors.get("digest")).toBeTruthy();
    });

    it("validates digest as hex", () => {
      const errors = validateDnssecForm({
        keyTag: "12345",
        alg: "8",
        digestType: "2",
        digest: "not-hex",
        maxSigLife: "",
        keyDataFlags: "",
        keyDataProtocol: "",
        keyDataAlgo: "",
        keyDataPubKey: "",
      });
      expect(errors.get("digest")).toBeTruthy();
    });

    it("accepts valid DNSSEC data", () => {
      const errors = validateDnssecForm({
        keyTag: "12345",
        alg: "8",
        digestType: "2",
        digest: "abcdef1234567890",
        maxSigLife: "",
        keyDataFlags: "",
        keyDataProtocol: "",
        keyDataAlgo: "",
        keyDataPubKey: "",
      });
      expect(errors.size).toBe(0);
    });
  });

  describe("buildDnsRecordPayload", () => {
    it("omits name for the apex record", () => {
      const payload = buildDnsRecordPayload(
        { type: "A", name: "", content: "1.2.3.4", ttl: "", prio: "", notes: "" },
        "example.com",
      );
      expect(payload.name).toBeUndefined();
    });

    it("treats the literal @ as the apex", () => {
      const payload = buildDnsRecordPayload(
        { type: "A", name: "@", content: "1.2.3.4", ttl: "", prio: "", notes: "" },
        "example.com",
      );
      expect(payload.name).toBeUndefined();
    });

    it("strips the parent domain from a fully qualified name", () => {
      const payload = buildDnsRecordPayload(
        { type: "A", name: "www.example.com", content: "1.2.3.4", ttl: "", prio: "", notes: "" },
        "example.com",
      );
      expect(payload.name).toBe("www");
    });

    it("preserves a relative name unchanged", () => {
      const payload = buildDnsRecordPayload(
        { type: "A", name: "www", content: "1.2.3.4", ttl: "", prio: "", notes: "" },
        "example.com",
      );
      expect(payload.name).toBe("www");
    });

    it("treats the FQDN equal to the parent domain as the apex", () => {
      const payload = buildDnsRecordPayload(
        { type: "A", name: "example.com", content: "1.2.3.4", ttl: "", prio: "", notes: "" },
        "example.com",
      );
      expect(payload.name).toBeUndefined();
    });

    it("treats the FQDN apex case-insensitively", () => {
      const payload = buildDnsRecordPayload(
        { type: "A", name: "EXAMPLE.COM", content: "1.2.3.4", ttl: "", prio: "", notes: "" },
        "example.com",
      );
      expect(payload.name).toBeUndefined();
    });
  });

  describe("stripParentDomain", () => {
    it("strips matching suffix case-insensitively", () => {
      expect(stripParentDomain("WWW.EXAMPLE.COM", "example.com")).toBe("WWW");
    });
    it("returns the input when the suffix does not match", () => {
      expect(stripParentDomain("mail.other.com", "example.com")).toBe("mail.other.com");
    });
    it("returns the input for the bare apex hostname", () => {
      expect(stripParentDomain("example.com", "example.com")).toBe("example.com");
    });
  });

  describe("priceStringToCents", () => {
    it("converts price strings to cents", () => {
      expect(priceStringToCents("9.99")).toBe(999);
      expect(priceStringToCents("10.50")).toBe(1050);
      expect(priceStringToCents("0.01")).toBe(1);
      expect(priceStringToCents("100")).toBe(10000);
    });

    it("handles edge cases", () => {
      expect(priceStringToCents("")).toBeUndefined();
      expect(priceStringToCents("invalid")).toBeUndefined();
    });
  });

  describe("centsToUsd", () => {
    it("converts cents to USD string", () => {
      expect(centsToUsd(999)).toBe("$9.99");
      expect(centsToUsd(1050)).toBe("$10.50");
      expect(centsToUsd(1)).toBe("$0.01");
      expect(centsToUsd(10000)).toBe("$100.00");
    });
  });
});
