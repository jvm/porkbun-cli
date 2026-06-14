/**
 * useMutation - small wrapper around TuiApiService mutation calls.
 *
 * TuiApiService catches its own errors and returns
 * ResourceState<{ status: 'error', error }> rather than rejecting. Naive
 * `try { await service.foo() } catch {}` handlers therefore report success
 * on failure. This hook forces callers to inspect the returned state and
 * exposes a uniform submitting flag and status update.
 */
import { useCallback, useState } from 'react';
import type { ResourceState } from '../types.js';

export interface UseMutationOptions {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export interface UseMutationResult {
  submitting: boolean;
  error: string | null;
  /**
   * Run a mutation. The callback should return a ResourceState from the
   * service; this hook inspects status and either invokes onSuccess with
   * the provided success message or onError with the API's error message.
   * Returns the ResourceState so callers can chain post-success work
   * (e.g. close the form, reload data).
   */
  run: <T>(serviceCall: () => Promise<ResourceState<T>>, successMessage: string) => Promise<ResourceState<T> | undefined>;
  clearError: () => void;
}

/**
 * Inspect a ResourceState and dispatch the appropriate callback.
 * Exported for unit testing so we can assert the bug fix without
 * rendering React.
 */
export async function runMutation<T>(
  serviceCall: () => Promise<ResourceState<T>>,
  successMessage: string,
  options: UseMutationOptions = {},
): Promise<ResourceState<T> | undefined> {
  try {
    const result = await serviceCall();
    if (result.status === 'loaded') {
      options.onSuccess?.(successMessage);
      return result;
    }
    const message = result.error?.message ?? 'Unknown error';
    options.onError?.(message);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    options.onError?.(message);
    return undefined;
  }
}

export function useMutation(options: UseMutationOptions = {}): UseMutationResult {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async <T>(serviceCall: () => Promise<ResourceState<T>>, successMessage: string): Promise<ResourceState<T> | undefined> => {
      setSubmitting(true);
      setError(null);
      try {
        const result = await runMutation(serviceCall, successMessage, {
          onSuccess: (m) => {
            setError(null);
            options.onSuccess?.(m);
          },
          onError: (m) => {
            setError(m);
            options.onError?.(m);
          },
        });
        return result;
      } finally {
        setSubmitting(false);
      }
    },
    [options],
  );

  const clearError = useCallback(() => setError(null), []);

  return { submitting, error, run, clearError };
}
