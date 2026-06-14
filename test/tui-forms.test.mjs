/**
 * Unit tests for TUI form validators
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
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
} from '../dist/tui/forms/validators.js';

describe('TUI Form Validators', () => {
  describe('validateDnsRecordForm', () => {
    it('validates required fields', () => {
      const errors = validateDnsRecordForm({ type: '', name: '', content: '', ttl: '', prio: '', notes: '' });
      assert.ok(errors.type);
      assert.ok(errors.content);
    });

    it('validates A record IPv4', () => {
      const errors = validateDnsRecordForm({ type: 'A', name: 'test', content: 'invalid', ttl: '', prio: '', notes: '' });
      assert.ok(errors.content?.includes('IPv4'));
    });

    it('accepts valid A record', () => {
      const errors = validateDnsRecordForm({ type: 'A', name: 'test', content: '192.168.1.1', ttl: '', prio: '', notes: '' });
      assert.strictEqual(Object.keys(errors).length, 0);
    });

    it('validates AAAA record IPv6', () => {
      const errors = validateDnsRecordForm({ type: 'AAAA', name: 'test', content: 'invalid', ttl: '', prio: '', notes: '' });
      assert.ok(errors.content?.includes('IPv6'));
    });

    it('accepts valid AAAA record', () => {
      const errors = validateDnsRecordForm({ type: 'AAAA', name: 'test', content: '2001:db8::1', ttl: '', prio: '', notes: '' });
      assert.strictEqual(Object.keys(errors).length, 0);
    });

    it('validates TTL as integer', () => {
      const errors = validateDnsRecordForm({ type: 'A', name: 'test', content: '1.2.3.4', ttl: 'invalid', prio: '', notes: '' });
      assert.ok(errors.ttl);
    });

    it('accepts valid TTL', () => {
      const errors = validateDnsRecordForm({ type: 'A', name: 'test', content: '1.2.3.4', ttl: '300', prio: '', notes: '' });
      assert.strictEqual(errors.ttl, undefined);
    });
  });

  describe('validateNameserverForm', () => {
    it('requires at least one nameserver', () => {
      const errors = validateNameserverForm({ nameservers: [] });
      assert.ok(errors.nameservers);
    });

    it('validates hostname format', () => {
      const errors = validateNameserverForm({ nameservers: ['invalid..hostname'] });
      assert.ok(errors.ns_0);
    });

    it('accepts valid nameservers', () => {
      const errors = validateNameserverForm({ nameservers: ['ns1.example.com', 'ns2.example.com'] });
      assert.strictEqual(Object.keys(errors).length, 0);
    });
  });

  describe('validateGlueForm', () => {
    it('validates IP addresses', () => {
      const errors = validateGlueForm({ subdomain: 'ns1', ips: ['invalid'] }, 'example.com');
      assert.ok(errors.ip_0);
    });

    it('accepts valid IPs', () => {
      const errors = validateGlueForm({ subdomain: 'ns1', ips: ['192.168.1.1', '2001:db8::1'] }, 'example.com');
      assert.strictEqual(Object.keys(errors).length, 0);
    });
  });

  describe('validateForwardForm', () => {
    it('requires http or https URLs', () => {
      const errors = validateForwardForm({ subdomain: '', location: 'ftp://example.com', type: 'permanent', includePath: false, wildcard: false });
      assert.ok(errors.location?.includes('http'));
    });

    it('accepts valid URLs', () => {
      const errors = validateForwardForm({ subdomain: 'www', location: 'https://example.com', type: 'permanent', includePath: false, wildcard: false });
      assert.strictEqual(Object.keys(errors).length, 0);
    });
  });

  describe('validateDnssecForm', () => {
    it('validates required fields', () => {
      const errors = validateDnssecForm({ keyTag: '', alg: '', digestType: '', digest: '', maxSigLife: '', keyDataFlags: '', keyDataProtocol: '', keyDataAlgo: '', keyDataPubKey: '' });
      assert.ok(errors.keyTag);
      assert.ok(errors.alg);
      assert.ok(errors.digestType);
      assert.ok(errors.digest);
    });

    it('validates digest as hex', () => {
      const errors = validateDnssecForm({ keyTag: '12345', alg: '8', digestType: '2', digest: 'not-hex', maxSigLife: '', keyDataFlags: '', keyDataProtocol: '', keyDataAlgo: '', keyDataPubKey: '' });
      assert.ok(errors.digest);
    });

    it('accepts valid DNSSEC data', () => {
      const errors = validateDnssecForm({ keyTag: '12345', alg: '8', digestType: '2', digest: 'abcdef1234567890', maxSigLife: '', keyDataFlags: '', keyDataProtocol: '', keyDataAlgo: '', keyDataPubKey: '' });
      assert.strictEqual(Object.keys(errors).length, 0);
    });
  });

  describe('buildDnsRecordPayload', () => {
    it('omits name for the apex record', () => {
      const payload = buildDnsRecordPayload(
        { type: 'A', name: '', content: '1.2.3.4', ttl: '', prio: '', notes: '' },
        'example.com',
      );
      assert.strictEqual(payload.name, undefined);
    });

    it('treats the literal @ as the apex', () => {
      const payload = buildDnsRecordPayload(
        { type: 'A', name: '@', content: '1.2.3.4', ttl: '', prio: '', notes: '' },
        'example.com',
      );
      assert.strictEqual(payload.name, undefined);
    });

    it('strips the parent domain from a fully qualified name', () => {
      const payload = buildDnsRecordPayload(
        { type: 'A', name: 'www.example.com', content: '1.2.3.4', ttl: '', prio: '', notes: '' },
        'example.com',
      );
      assert.strictEqual(payload.name, 'www');
    });

    it('preserves a relative name unchanged', () => {
      const payload = buildDnsRecordPayload(
        { type: 'A', name: 'www', content: '1.2.3.4', ttl: '', prio: '', notes: '' },
        'example.com',
      );
      assert.strictEqual(payload.name, 'www');
    });
  });

  describe('stripParentDomain', () => {
    it('strips matching suffix case-insensitively', () => {
      assert.strictEqual(stripParentDomain('WWW.EXAMPLE.COM', 'example.com'), 'WWW');
    });
    it('returns the input when the suffix does not match', () => {
      assert.strictEqual(stripParentDomain('mail.other.com', 'example.com'), 'mail.other.com');
    });
    it('returns the input for the bare apex hostname', () => {
      assert.strictEqual(stripParentDomain('example.com', 'example.com'), 'example.com');
    });
  });

  describe('priceStringToCents', () => {
    it('converts price strings to cents', () => {
      assert.strictEqual(priceStringToCents('9.99'), 999);
      assert.strictEqual(priceStringToCents('10.50'), 1050);
      assert.strictEqual(priceStringToCents('0.01'), 1);
      assert.strictEqual(priceStringToCents('100'), 10000);
    });

    it('handles edge cases', () => {
      assert.strictEqual(priceStringToCents(''), undefined);
      assert.strictEqual(priceStringToCents('invalid'), undefined);
    });
  });

  describe('centsToUsd', () => {
    it('converts cents to USD string', () => {
      assert.strictEqual(centsToUsd(999), '$9.99');
      assert.strictEqual(centsToUsd(1050), '$10.50');
      assert.strictEqual(centsToUsd(1), '$0.01');
      assert.strictEqual(centsToUsd(10000), '$100.00');
    });
  });
});
