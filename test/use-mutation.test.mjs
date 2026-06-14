/**
 * Unit tests for the runMutation helper used by useMutation.
 *
 * TuiApiService catches its own errors and returns a ResourceState with
 * status: 'error' rather than rejecting. A naive try/await/catch wrapper
 * around a service call therefore reports success on failure. The hook
 * (and its underlying runMutation helper) is the only safe way to invoke
 * a service call from a screen.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { runMutation } from '../dist/tui/hooks/useMutation.js';

describe('runMutation', () => {
  it('invokes onSuccess and returns the loaded state when the service call succeeds', async () => {
    let successMsg = null;
    let errorMsg = null;
    const returned = await runMutation(
      async () => ({ status: 'loaded', data: { ok: true }, timestamp: 1 }),
      'worked',
      {
        onSuccess: (m) => { successMsg = m; },
        onError: (m) => { errorMsg = m; },
      },
    );
    assert.strictEqual(returned.status, 'loaded');
    assert.strictEqual(successMsg, 'worked');
    assert.strictEqual(errorMsg, null);
  });

  it('invokes onError and does NOT report success when the service returns status: error', async () => {
    let successMsg = null;
    let errorMsg = null;
    const returned = await runMutation(
      async () => ({
        status: 'error',
        error: new Error('boom'),
        retryable: true,
        timestamp: 1,
      }),
      'should not be shown',
      {
        onSuccess: (m) => { successMsg = m; },
        onError: (m) => { errorMsg = m; },
      },
    );
    assert.strictEqual(successMsg, null);
    assert.strictEqual(errorMsg, 'boom');
    assert.strictEqual(returned.status, 'error');
  });

  it('catches unexpected thrown errors and routes them to onError', async () => {
    let errorMsg = null;
    const returned = await runMutation(
      async () => { throw new Error('network down'); },
      'never',
      { onError: (m) => { errorMsg = m; } },
    );
    assert.strictEqual(errorMsg, 'network down');
    assert.strictEqual(returned, undefined);
  });
});
