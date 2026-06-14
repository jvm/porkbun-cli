/**
 * Unit tests for the runMutation helper used by useMutation.
 *
 * TuiApiService catches its own errors and returns a ResourceState with
 * status: 'error' rather than rejecting. A naive try/await/catch wrapper
 * around a service call therefore reports success on failure. The hook
 * (and its underlying runMutation helper) is the only safe way to invoke
 * a service call from a screen.
 */
import { describe, it, expect } from "vitest";
import { runMutation } from "../src/tui/hooks/useMutation.js";

describe("runMutation", () => {
  it("invokes onSuccess and returns the loaded state when the service call succeeds", async () => {
    let successMsg: string | null = null;
    let errorMsg: string | null = null;
    const returned = await runMutation(
      async () => ({ status: "loaded" as const, data: { ok: true }, timestamp: 1 }),
      "worked",
      {
        onSuccess: (m) => {
          successMsg = m;
        },
        onError: (m) => {
          errorMsg = m;
        },
      },
    );
    expect(returned.status).toBe("loaded");
    expect(successMsg).toBe("worked");
    expect(errorMsg).toBeNull();
  });

  it("invokes onError and does NOT report success when the service returns status: error", async () => {
    let successMsg: string | null = null;
    let errorMsg: string | null = null;
    const returned = await runMutation(
      async () => ({
        status: "error" as const,
        error: new Error("boom"),
        retryable: true,
        timestamp: 1,
      }),
      "should not be shown",
      {
        onSuccess: (m) => {
          successMsg = m;
        },
        onError: (m) => {
          errorMsg = m;
        },
      },
    );
    expect(successMsg).toBeNull();
    expect(errorMsg).toBe("boom");
    expect(returned.status).toBe("error");
  });

  it("catches unexpected thrown errors and routes them to onError", async () => {
    let errorMsg: string | null = null;
    const returned = await runMutation(
      async () => {
        throw new Error("network down");
      },
      "never",
      {
        onError: (m) => {
          errorMsg = m;
        },
      },
    );
    expect(errorMsg).toBe("network down");
    expect(returned).toBeUndefined();
  });
});
