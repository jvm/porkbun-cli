import { createHash, randomUUID } from "node:crypto";
import { resolveCredentials, type CredentialInput, type Credentials } from "./config.js";
import { CliError, kindForApiCode } from "./errors.js";
import { isSecretKey, redact } from "./output.js";
import type { OperationDefinition } from "./operations.js";

export interface ApiClientOptions extends CredentialInput {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  ipv4?: boolean;
  timeoutMs?: number;
  verbose?: boolean;
}

export interface OperationRequest {
  pathParams?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  dryRun?: boolean;
  idempotencyKey?: string;
  freshIdempotencyKey?: boolean;
}

export interface DryRunResult {
  dryRun: true;
  operationId: string;
  method: string;
  url: string;
  mutating: boolean;
  auth: "none" | "optional" | "required";
  idempotencyKey?: string;
  body?: unknown;
  query?: unknown;
}

const DEFAULT_BASE_URL = "https://api.porkbun.com/api/json/v3";
const IPV4_BASE_URL = "https://api-ipv4.porkbun.com/api/json/v3";
const DEFAULT_TIMEOUT_MS = 30_000;

export class ApiClient {
  private options: ApiClientOptions;

  constructor(options: ApiClientOptions = {}) {
    this.options = options;
  }

  async request(operation: OperationDefinition, request: OperationRequest = {}): Promise<unknown> {
    const credentials = await this.credentialsFor(operation, Boolean(request.dryRun));
    const path = fillPath(operation.path, request.pathParams ?? {});
    const query = cleanObject(request.query ?? {});
    const body = cleanObject(request.body ?? {});
    const placement = authPlacement(operation);
    const method = operation.method;
    const headers = new Headers({
      "User-Agent": "porkbun-cli/0.1.1"
    });

    let requestBody: Record<string, unknown> | undefined;
    if (method === "POST" || Object.keys(body).length > 0) {
      requestBody = { ...body };
    }

    if (credentials && placement === "header") {
      headers.set("X-API-Key", credentials.apiKey);
      headers.set("X-Secret-API-Key", credentials.secretApiKey);
    } else if (credentials && placement === "body") {
      requestBody = {
        ...(requestBody ?? {}),
        apikey: credentials.apiKey,
        secretapikey: credentials.secretApiKey
      };
    }

    const url = buildUrl(this.baseUrl(Boolean(credentials) && !request.dryRun), path, query);
    const idempotencyKey = operation.mutating
      ? request.idempotencyKey ??
        (request.freshIdempotencyKey ? randomUUID() : deterministicIdempotencyKey(operation, path, body))
      : undefined;
    if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);

    if (request.dryRun) {
      return {
        dryRun: true,
        operationId: operation.operationId,
        method,
        mutating: operation.mutating,
        auth: operation.auth,
        idempotencyKey,
        body: requestBody ? redact(requestBody) : undefined,
        url: redactUrl(url),
        query: Object.keys(query).length > 0 ? redact(query) : undefined
      } satisfies DryRunResult;
    }

    if (method === "POST") headers.set("Content-Type", "application/json");
    if (this.options.verbose) {
      process.stderr.write(`${method} ${redactUrl(url)}\n`);
    }

    let response: Response;
    try {
      response = await (this.options.fetch ?? globalThis.fetch)(url, {
        method,
        headers,
        body: method === "POST" ? JSON.stringify(requestBody ?? {}) : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
      });
    } catch (error) {
      const timeout =
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError" || error.message.includes("timed out"));
      throw new CliError({
        kind: timeout ? "timeout" : "network",
        message: timeout ? `Request timed out after ${this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS} ms.` : "Network request failed.",
        retryable: true,
        details: error instanceof Error ? error.message : String(error)
      });
    }

    const requestId = response.headers.get("X-Request-Id") ?? undefined;
    const data = await parseResponse(response);
    if (!response.ok || responseHasError(data)) {
      const apiError = isRecord(data) ? data : {};
      const code = typeof apiError.code === "string" ? apiError.code : undefined;
      const message =
        typeof apiError.message === "string"
          ? apiError.message
          : response.statusText || `Porkbun API returned HTTP ${response.status}`;
      const kind = kindForApiCode(code, response.status);
      throw new CliError({
        kind,
        code,
        message,
        requestId: typeof apiError.requestId === "string" ? apiError.requestId : requestId,
        retryable: kind === "rate_limit" || response.status >= 500,
        details: cleanObject({
          httpStatus: response.status,
          ttlRemaining: apiError.ttlRemaining,
          rateLimitReset: response.headers.get("X-RateLimit-Reset") ?? undefined
        })
      });
    }

    return data;
  }

  private baseUrl(hasCredentials: boolean): string {
    return validateBaseUrl(
      this.options.baseUrl ?? (this.options.ipv4 ? IPV4_BASE_URL : DEFAULT_BASE_URL),
      hasCredentials
    );
  }

  private async credentialsFor(operation: OperationDefinition, dryRun: boolean): Promise<Credentials | undefined> {
    if (operation.auth === "none") return undefined;
    return resolveCredentials(this.options, operation.auth === "required" && !dryRun);
  }
}

export function validateBaseUrl(value: string, hasCredentials = false): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CliError({ kind: "usage", message: `Invalid API base URL: ${value}` });
  }

  if (url.username || url.password) {
    throw new CliError({ kind: "usage", message: "API base URLs must not contain embedded credentials." });
  }
  if (url.search || url.hash) {
    throw new CliError({ kind: "usage", message: "API base URLs must not contain query parameters or fragments." });
  }

  const loopback = url.hostname === "127.0.0.1" || url.hostname === "::1" || url.hostname === "localhost";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new CliError({
      kind: "usage",
      message: "API base URLs must use HTTPS. Plain HTTP is allowed only for loopback testing."
    });
  }

  if (hasCredentials) {
    const officialOrigin =
      url.origin === "https://api.porkbun.com" ||
      url.origin === "https://api-ipv4.porkbun.com";
    if (!officialOrigin) {
      throw new CliError({
        kind: "usage",
        message: "Refusing to send Porkbun credentials to a non-Porkbun API origin."
      });
    }
  }

  return stripTrailingSlash(url.toString());
}

export function redactUrl(value: string): string {
  const url = new URL(value);
  for (const key of new Set(url.searchParams.keys())) {
    if (isSecretKey(key.replace(/\[\]$/, ""))) {
      url.searchParams.set(key, "[REDACTED]");
    }
  }
  return url.toString();
}

export function deterministicIdempotencyKey(
  operation: Pick<OperationDefinition, "operationId">,
  path: string,
  body: Record<string, unknown>
): string {
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        operationId: operation.operationId,
        path,
        body: removeCredentialFields(body)
      })
    )
    .digest("hex");
  return `porkbun-cli:${hash.slice(0, 48)}`;
}

export function buildUrl(baseUrl: string, path: string, query: Record<string, unknown> = {}): string {
  const url = new URL(`${stripTrailingSlash(baseUrl)}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry !== undefined && entry !== null && entry !== "") {
          url.searchParams.append(`${key}[]`, String(entry));
        }
      }
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export function fillPath(path: string, params: Record<string, unknown>): string {
  return path.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = params[key];
    if (value === undefined || value === null) {
      throw new CliError({
        kind: "usage",
        message: `Missing required path parameter: ${key}`
      });
    }
    return encodeURIComponent(String(value));
  });
}

function authPlacement(operation: OperationDefinition): "header" | "body" {
  if (operation.authPlacement === "header" || operation.authPlacement === "body") return operation.authPlacement;
  return operation.method === "GET" ? "header" : "body";
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { status: response.ok ? "SUCCESS" : "ERROR", message: text };
  }
}

function responseHasError(data: unknown): boolean {
  return isRecord(data) && data.status === "ERROR";
}

function removeCredentialFields(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== "apikey" && key !== "secretapikey")
  );
}

function cleanObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== "")
  ) as T;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
