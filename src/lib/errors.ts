export const EXIT_CODES = {
  success: 0,
  usage: 2,
  auth: 3,
  conflict: 4,
  rateLimit: 5,
  network: 6,
  api: 7,
} as const;

export type ErrorKind =
  | "usage"
  | "auth"
  | "validation"
  | "not_found"
  | "conflict"
  | "rate_limit"
  | "network"
  | "timeout"
  | "api_error";

export class CliError extends Error {
  kind: ErrorKind;
  code?: string;
  requestId?: string;
  retryable: boolean;
  exitCode: number;
  details?: unknown;

  constructor(input: {
    kind: ErrorKind;
    message: string;
    code?: string;
    requestId?: string;
    retryable?: boolean;
    exitCode?: number;
    details?: unknown;
  }) {
    super(input.message);
    this.name = "CliError";
    this.kind = input.kind;
    this.code = input.code;
    this.requestId = input.requestId;
    this.retryable = input.retryable ?? false;
    this.exitCode = input.exitCode ?? exitCodeForKind(input.kind);
    this.details = input.details;
  }
}

export function exitCodeForKind(kind: ErrorKind): number {
  switch (kind) {
    case "usage":
    case "validation":
      return EXIT_CODES.usage;
    case "auth":
      return EXIT_CODES.auth;
    case "conflict":
      return EXIT_CODES.conflict;
    case "rate_limit":
      return EXIT_CODES.rateLimit;
    case "network":
    case "timeout":
      return EXIT_CODES.network;
    default:
      return EXIT_CODES.api;
  }
}

export function kindForApiCode(code?: string, httpStatus?: number): ErrorKind {
  if (httpStatus === 401 || httpStatus === 403) return "auth";
  if (httpStatus === 404) return "not_found";
  if (httpStatus === 409) return "conflict";
  if (httpStatus === 429 || code === "RATE_LIMIT_EXCEEDED") return "rate_limit";
  if (!code) return "api_error";

  if (
    code === "API_KEY_REQUIRED" ||
    code === "INVALID_API_KEYS_001" ||
    code === "INVALID_TOKEN" ||
    code === "INVALID_USER"
  ) {
    return "auth";
  }

  if (code.startsWith("IDEMPOTENCY_KEY_")) return "conflict";
  if (code.includes("NOT_FOUND") || code === "INVALID_RECORD_ID") return "not_found";
  if (code.startsWith("INVALID_") || code === "DOMAIN_NOT_AVAILABLE") return "validation";
  return "api_error";
}

export function errorEnvelope(error: unknown): { error: Record<string, unknown> } {
  if (error instanceof CliError) {
    return {
      error: cleanObject({
        kind: error.kind,
        code: error.code,
        message: error.message,
        requestId: error.requestId,
        retryable: error.retryable,
        details: error.details,
      }),
    };
  }

  return {
    error: {
      kind: "api_error",
      message: error instanceof Error ? error.message : String(error),
      retryable: false,
    },
  };
}

function cleanObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
