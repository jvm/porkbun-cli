/**
 * Unit tests for TUI state management and navigation
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getConfirmationLevel,
} from '../dist/tui/state/app.js';
import {
  getBreakpoint,
} from '../dist/tui/types.js';

describe('TUI State Management', () => {
  describe('getConfirmationLevel', () => {
    it('returns billable for domain registration', () => {
      assert.strictEqual(getConfirmationLevel('domainCreate'), 'billable');
    });

    it('returns billable for domain renewal', () => {
      assert.strictEqual(getConfirmationLevel('domainRenew'), 'billable');
    });

    it('returns billable for domain transfer', () => {
      assert.strictEqual(getConfirmationLevel('transferDomain'), 'billable');
    });

    it('returns disruptive for destructive operations', () => {
      assert.strictEqual(getConfirmationLevel('dnsDelete'), 'disruptive');
      assert.strictEqual(getConfirmationLevel('domainDeleteGlue'), 'disruptive');
    });

    it('returns disruptive for nameserver updates', () => {
      assert.strictEqual(getConfirmationLevel('domainUpdateNs'), 'disruptive');
    });

    it('returns standard for regular mutations', () => {
      assert.strictEqual(getConfirmationLevel('dnsCreate'), 'standard');
      assert.strictEqual(getConfirmationLevel('dnsEdit'), 'standard');
    });
  });

  describe('getBreakpoint', () => {
    it('returns minimum for small terminals', () => {
      assert.strictEqual(getBreakpoint(50, 15), 'minimum');
      assert.strictEqual(getBreakpoint(60, 17), 'minimum');
    });

    it('returns compact for medium-small terminals', () => {
      assert.strictEqual(getBreakpoint(60, 18), 'compact');
      assert.strictEqual(getBreakpoint(79, 24), 'compact');
    });

    it('returns medium for medium terminals', () => {
      assert.strictEqual(getBreakpoint(80, 24), 'medium');
      assert.strictEqual(getBreakpoint(119, 40), 'medium');
    });

    it('returns wide for large terminals', () => {
      assert.strictEqual(getBreakpoint(120, 40), 'wide');
      assert.strictEqual(getBreakpoint(200, 50), 'wide');
    });
  });
});
