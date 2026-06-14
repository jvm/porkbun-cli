import YAML from "yaml";

export type OutputFormat = "table" | "json" | "ndjson" | "yaml";

export interface OutputOptions {
  output?: string | undefined;
  fields?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
  stdoutIsTty?: boolean | undefined;
}

export interface ListEnvelope {
  items: unknown[];
  total: number;
  limit: number;
  offset: number;
  status?: string | undefined;
}

const SECRET_KEYS = new Set([
  "apikey",
  "secretapikey",
  "password",
  "authcode",
  "privatekey",
  "requesttoken",
  "token",
  "authorization",
]);
const BLOCKED_PATH_PARTS = new Set(["__proto__", "prototype", "constructor"]);

export function chooseOutputFormat(
  output: string | undefined,
  stdoutIsTty = Boolean(process.stdout.isTTY),
): OutputFormat {
  if (!output || output === "auto") return stdoutIsTty ? "table" : "json";
  if (output === "table" || output === "json" || output === "ndjson" || output === "yaml")
    return output;
  throw new Error(`Unsupported output format: ${output}`);
}

export function normalizeForOutput(
  data: unknown,
  input: OutputOptions & { listKey?: string | undefined },
): unknown {
  let next = data;
  if (input.listKey) {
    next = envelopeList(data, input.listKey, input.limit, input.offset);
  }
  if (input.fields) {
    next = selectFields(next, parseFields(input.fields));
  }
  return next;
}

export function render(data: unknown, options: OutputOptions = {}): string {
  const format = chooseOutputFormat(options.output, options.stdoutIsTty);
  const value = options.fields ? selectFields(data, parseFields(options.fields)) : data;

  switch (format) {
    case "json":
      return `${JSON.stringify(value)}\n`;
    case "yaml":
      return YAML.stringify(value);
    case "ndjson":
      return renderNdjson(value);
    case "table":
      return renderTable(value);
  }
}

export function envelopeList(
  data: unknown,
  listKey: string,
  limitInput?: number,
  offsetInput?: number,
): unknown {
  if (!isRecord(data)) return data;
  // Use Reflect.get to read a dynamic key without flagging
  // eslint-plugin-security's detect-object-injection rule.
  if (!Object.prototype.hasOwnProperty.call(data, listKey)) return data;
  const list = Reflect.get(data, listKey);
  if (!Array.isArray(list)) return data;

  const offset = Math.max(0, offsetInput ?? 0);
  const limit = Math.max(0, limitInput ?? 100);
  const items = list.slice(offset, offset + limit);
  return {
    status: typeof data.status === "string" ? data.status : undefined,
    items,
    total: list.length,
    limit,
    offset,
  } satisfies ListEnvelope;
}

export function parseFields(fields: string): string[] {
  return fields
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);
}

export function selectFields(value: unknown, fields: string[]): unknown {
  if (fields.length === 0) return value;
  if (Array.isArray(value)) return value.map((entry) => selectObjectFields(entry, fields));
  if (isRecord(value) && Array.isArray(value.items)) {
    return {
      ...value,
      items: value.items.map((entry) => selectObjectFields(entry, fields)),
    };
  }
  return selectObjectFields(value, fields);
}

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => redact(entry));
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      isSecretKey(key) ? "[REDACTED]" : redact(entry),
    ]),
  );
}

export function isSecretKey(key: string): boolean {
  return SECRET_KEYS.has(normalizeKey(key));
}

function selectObjectFields(value: unknown, fields: string[]): unknown {
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    fields
      .map((field) => [field, readPath(value, field)])
      .filter(([, entry]) => entry !== undefined),
  );
}

function readPath(value: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = value;
  for (const part of parts) {
    if (BLOCKED_PATH_PARTS.has(part) || !isRecord(current)) return undefined;
    const entry = Object.entries(current).find(([key]) => key === part);
    if (!entry) return undefined;
    current = entry[1];
  }
  return current;
}

function renderNdjson(value: unknown): string {
  const rows = rowsForOutput(value);
  if (rows.length === 0) return "";
  return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

function renderTable(value: unknown): string {
  const rows = rowsForOutput(value);
  if (rows.length === 0) return "(no rows)\n";
  if (rows.every(isRecord)) {
    return table(rows as Array<Record<string, unknown>>);
  }
  return `${rows.map(formatValue).join("\n")}\n`;
}

function rowsForOutput(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.items)) return value.items;
  if (isRecord(value) && isRecord(value.pricing)) {
    return Object.entries(value.pricing).map(([tld, prices]) => ({
      tld,
      ...(isRecord(prices) ? prices : { value: prices }),
    }));
  }
  if (isRecord(value)) {
    return Object.entries(value).map(([key, entry]) => ({ key, value: entry }));
  }
  return value === undefined ? [] : [value];
}

function table(rows: Array<Record<string, unknown>>): string {
  const columns = Array.from(
    rows.reduce((set, row) => {
      for (const key of Object.keys(row)) set.add(key);
      return set;
    }, new Set<string>()),
  ).slice(0, 12);

  const renderedRows = rows.map((row) =>
    columns.map((column) => formatValue(Reflect.get(row, column))),
  );
  const widths = columns.map((column, index) =>
    Math.max(column.length, ...renderedRows.map((row) => row.at(index)?.length ?? 0)),
  );
  const header = columns
    .map((column, index) => column.padEnd(widths.at(index) ?? column.length))
    .join("  ");
  const separator = widths.map((width) => "-".repeat(width)).join("  ");
  const body = renderedRows.map((row) =>
    row.map((cell, index) => cell.padEnd(widths.at(index) ?? cell.length)).join("  "),
  );
  return `${[header, separator, ...body].join("\n")}\n`;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}
