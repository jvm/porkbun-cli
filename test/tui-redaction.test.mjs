/**
 * Unit tests for TUI redaction and sanitization utilities
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  sanitizeString,
  truncateField,
  isSensitiveKey,
  redactReviewValue,
  redactErrorValue,
  redactObject,
} from '../dist/tui/redact.js';

describe('TUI Redaction Utilities', () => {
  describe('sanitizeString', () => {
    it('removes control characters', () => {
      assert.strictEqual(sanitizeString('test\x00\x01\x02'), 'test');
    });

    it('removes ANSI escape sequences', () => {
      assert.strictEqual(sanitizeString('test\x1B[31mred\x1B[0m'), 'testred');
    });

    it('handles null and undefined', () => {
      assert.strictEqual(sanitizeString(null), '');
      assert.strictEqual(sanitizeString(undefined), '');
    });

    it('converts non-strings to strings', () => {
      assert.strictEqual(sanitizeString(123), '123');
      assert.strictEqual(sanitizeString(true), 'true');
    });
  });

  describe('truncateField', () => {
    it('truncates long strings', () => {
      const long = 'a'.repeat(250);
      const result = truncateField(long);
      assert.ok(result.length <= 200);
      assert.ok(result.endsWith('…'));
    });

    it('does not truncate short strings', () => {
      const short = 'test string';
      assert.strictEqual(truncateField(short), short);
    });

    it('respects custom max length', () => {
      const result = truncateField('test string', 5);
      assert.ok(result.length <= 5);
    });
  });

  describe('isSensitiveKey', () => {
    it('identifies API keys', () => {
      assert.strictEqual(isSensitiveKey('apikey'), true);
      assert.strictEqual(isSensitiveKey('api_key'), true);
      assert.strictEqual(isSensitiveKey('API_KEY'), true);
    });

    it('identifies secret keys', () => {
      assert.strictEqual(isSensitiveKey('secretapikey'), true);
      assert.strictEqual(isSensitiveKey('secret_api_key'), true);
    });

    it('identifies passwords', () => {
      assert.strictEqual(isSensitiveKey('password'), true);
      assert.strictEqual(isSensitiveKey('PASSWORD'), true);
    });

    it('identifies auth codes', () => {
      assert.strictEqual(isSensitiveKey('authcode'), true);
      assert.strictEqual(isSensitiveKey('auth_code'), true);
    });

    it('identifies private keys', () => {
      assert.strictEqual(isSensitiveKey('privatekey'), true);
      assert.strictEqual(isSensitiveKey('private_key'), true);
    });

    it('does not flag non-sensitive keys', () => {
      assert.strictEqual(isSensitiveKey('domain'), false);
      assert.strictEqual(isSensitiveKey('name'), false);
      assert.strictEqual(isSensitiveKey('content'), false);
    });
  });

  describe('redactReviewValue', () => {
    it('redacts sensitive keys', () => {
      assert.strictEqual(redactReviewValue('apikey', 'secret123'), '[REDACTED]');
      assert.strictEqual(redactReviewValue('password', 'pass123'), '[REDACTED]');
    });

    it('sanitizes non-sensitive values', () => {
      assert.strictEqual(redactReviewValue('domain', 'test.com'), 'test.com');
    });
  });

  describe('redactErrorValue', () => {
    it('redacts API key patterns', () => {
      const error = 'Error with pk1_live_abc123xyz in message';
      const result = redactErrorValue(error);
      assert.ok(!result.includes('pk1_live_abc123xyz'));
      assert.ok(result.includes('[REDACTED]'));
    });

    it('redacts secret key patterns', () => {
      const error = 'Error with sk1_live_abc123xyz in message';
      const result = redactErrorValue(error);
      assert.ok(!result.includes('sk1_live_abc123xyz'));
      assert.ok(result.includes('[REDACTED]'));
    });

    it('redacts private key blocks', () => {
      const error = 'Error with -----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----';
      const result = redactErrorValue(error);
      assert.ok(!result.includes('PRIVATE KEY'));
      assert.ok(result.includes('[REDACTED]'));
    });
  });

  describe('redactObject', () => {
    it('redacts sensitive fields in objects', () => {
      const obj = {
        domain: 'example.com',
        apikey: 'secret123',
        password: 'pass123',
      };
      const result = redactObject(obj);
      assert.strictEqual(result.domain, 'example.com');
      assert.strictEqual(result.apikey, '[REDACTED]');
      assert.strictEqual(result.password, '[REDACTED]');
    });

    it('handles nested objects', () => {
      const obj = {
        domain: 'example.com',
        credentials: {
          apikey: 'secret123',
        },
      };
      const result = redactObject(obj);
      assert.strictEqual(result.domain, 'example.com');
      const credentials = result.credentials;
      assert.ok(typeof credentials === 'object' && credentials !== null);
      assert.strictEqual(credentials.apikey, '[REDACTED]');
    });
  });
});
