/**
 * Mutation hook implementing the state machine:
 * edit -> validate -> review -> confirm -> submit -> reconcile -> result
 */
import { useState, useCallback } from 'react';
import type { ApiClient } from '../../lib/api-client.js';
import type { OperationDefinition } from '../../lib/operations.js';
import { deterministicIdempotencyKey } from '../../lib/api-client.js';
import type { OperationResult, ConfirmationLevel, ReviewSnapshot } from '../types.js';

export type MutationPhase =
  | 'idle'
  | 'edit'
  | 'validating'
  | 'review'
  | 'confirming'
  | 'submitting'
  | 'reconciling'
  | 'success'
  | 'error';

export interface MutationState {
  phase: MutationPhase;
  values: Record<string, unknown>;
  errors: Record<string, string>;
  touched: Set<string>;
  reviewSnapshot?: ReviewSnapshot;
  idempotencyKey?: string;
  result?: OperationResult;
  confirmationInput?: string;
}

export interface UseMutationOptions {
  operation: OperationDefinition;
  domain?: string;
  confirmationLevel: ConfirmationLevel;
  buildPayload: (values: Record<string, unknown>) => Record<string, unknown>;
  buildReviewSnapshot: (values: Record<string, unknown>, payload: Record<string, unknown>) => ReviewSnapshot;
  validate: (values: Record<string, unknown>) => Record<string, string>;
  onSuccess?: (result: unknown) => void;
  cacheKeysToInvalidate?: string[];
}

export function useMutation(client: ApiClient, options: UseMutationOptions) {
  const [state, setState] = useState<MutationState>({
    phase: 'idle',
    values: {},
    errors: {},
    touched: new Set(),
  });

  const startEdit = useCallback((initialValues: Record<string, unknown> = {}) => {
    setState({
      phase: 'edit',
      values: initialValues,
      errors: {},
      touched: new Set(),
    });
  }, []);

  const updateValue = useCallback((field: string, value: unknown) => {
    setState(prev => ({
      ...prev,
      values: { ...prev.values, [field]: value },
      touched: new Set([...prev.touched, field]),
    }));
  }, []);

  const validate = useCallback(() => {
    setState(prev => ({ ...prev, phase: 'validating' }));
    const errors = options.validate(state.values);
    if (Object.keys(errors).length > 0) {
      setState(prev => ({
        ...prev,
        phase: 'edit',
        errors,
      }));
      return false;
    }

    // Build payload and review snapshot
    const payload = options.buildPayload(state.values);
    const reviewSnapshot = options.buildReviewSnapshot(state.values, payload);

    // Generate idempotency key
    const path = options.operation.path;
    const idempotencyKey = deterministicIdempotencyKey(options.operation, path, payload);

    setState(prev => ({
      ...prev,
      phase: 'review',
      errors: {},
      reviewSnapshot,
      idempotencyKey,
    }));
    return true;
  }, [state.values, options]);

  const startConfirm = useCallback(() => {
    setState(prev => ({
      ...prev,
      phase: 'confirming',
      confirmationInput: '',
    }));
  }, []);

  const updateConfirmationInput = useCallback((input: string) => {
    setState(prev => ({
      ...prev,
      confirmationInput: input,
    }));
  }, []);

  const canConfirm = useCallback(() => {
    if (!state.reviewSnapshot) return false;
    const { confirmationLevel } = options;

    switch (confirmationLevel) {
      case 'standard':
        return true; // Just need to press confirm key
      case 'disruptive':
        return true; // Explicit confirm button
      case 'bulk-disruptive':
        // Must type the count
        const count = state.reviewSnapshot.fields.find(f => f.label === 'Domain count')?.value;
        return state.confirmationInput === count;
      case 'billable':
        // Must type the domain
        const domain = state.reviewSnapshot.fields.find(f => f.label === 'Domain')?.value;
        return state.confirmationInput === domain;
      default:
        return false;
    }
  }, [state, options.confirmationLevel]);

  const submit = useCallback(async () => {
    if (!canConfirm()) return;

    setState(prev => ({ ...prev, phase: 'submitting' }));

    try {
      const payload = options.buildPayload(state.values);
      const result = await client.request(options.operation, {
        body: payload,
        pathParams: options.domain ? { domain: options.domain } : undefined,
        idempotencyKey: state.idempotencyKey,
      });

      setState(prev => ({
        ...prev,
        phase: 'reconciling',
      }));

      // Reconcile: invalidate cache keys
      // (Cache invalidation would be handled by the app state manager)

      setState(prev => ({
        ...prev,
        phase: 'success',
        result: {
          success: true,
          message: 'Operation completed successfully',
          data: result,
        },
      }));

      options.onSuccess?.(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState(prev => ({
        ...prev,
        phase: 'error',
        result: {
          success: false,
          message: err.message,
          error: err,
        },
      }));
    }
  }, [state, options, client, canConfirm]);

  const reset = useCallback(() => {
    setState({
      phase: 'idle',
      values: {},
      errors: {},
      touched: new Set(),
    });
  }, []);

  const backToEdit = useCallback(() => {
    setState(prev => ({
      ...prev,
      phase: 'edit',
    }));
  }, []);

  const cancel = useCallback(() => {
    reset();
  }, [reset]);

  return {
    state,
    startEdit,
    updateValue,
    validate,
    startConfirm,
    updateConfirmationInput,
    canConfirm,
    submit,
    backToEdit,
    cancel,
    reset,
  };
}
