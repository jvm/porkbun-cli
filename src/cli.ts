#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline/promises";
import { Command, CommanderError, InvalidArgumentError } from "commander";
import { ApiClient } from "./lib/api-client.js";
import { configFileMode, configPath, deleteProfile, listProfiles, resolveCredentials, saveProfile } from "./lib/config.js";
import { CliError, errorEnvelope } from "./lib/errors.js";
import { normalizeForOutput, render } from "./lib/output.js";
import { buildCliSchema } from "./lib/schema.js";
import { OPERATIONS, OPERATIONS_BY_ID, requireOperation, type OperationDefinition } from "./lib/operations.js";
import {
  CLI_COMMANDS,
  defaultInvocation,
  type CliCommandDefinition,
  type CommandOptionDefinition,
  type OperationInvocation
} from "./commands/definitions.js";
import { launchTui } from "./tui/index.js";

const VERSION = "0.1.1";

export async function run(argv = process.argv): Promise<void> {
  const program = buildProgram();
  try {
    await program.parseAsync(argv);
  } catch (error) {
    if (error instanceof CommanderError && (error.code === "commander.helpDisplayed" || error.code === "commander.version")) {
      return;
    }
    const normalized =
      error instanceof CommanderError
        ? new CliError({ kind: "usage", message: error.message })
        : error;
    process.stderr.write(`${JSON.stringify(errorEnvelope(normalized))}\n`);
    process.exitCode = normalized instanceof CliError ? normalized.exitCode : 7;
  }
}

export function buildProgram(): Command {
  const program = new Command();
  program
    .name("porkbun")
    .description("Agent-friendly CLI for the Porkbun API v3. Bare interactive invocation launches the TUI.")
    .version(VERSION)
    .showHelpAfterError(false)
    .exitOverride()
    .configureOutput({ writeErr: () => undefined });

  addGlobalOptions(program);
  registerOperationCommands(program);
  registerAuthCommands(program);
  registerApiCommands(program);
  registerSchemaCommand(program);
  registerTuiCommand(program);
  registerRootAction(program);

  return program;
}

function addGlobalOptions(program: Command): void {
  program
    .option("-o, --output <format>", "Output format: table, json, ndjson, yaml, or auto.", "auto")
    .option("--fields <fields>", "Comma-separated fields to include in structured output.")
    .option("--limit <n>", "Maximum list items to emit. Defaults to 100 for list commands.", parseInteger)
    .option("--offset <n>", "Client-side list offset. Also maps to API start where supported.", parseInteger)
    .option("--profile <profile>", "Saved profile name to use.")
    .option("--api-key <key>", "Porkbun API key. Prefer PORKBUN_API_KEY for agents.")
    .option("--secret-api-key <key>", "Porkbun secret API key. Prefer PORKBUN_SECRET_API_KEY for agents.")
    .option("--base-url <url>", "Override Porkbun API base URL.")
    .option("--ipv4", "Use the Porkbun IPv4-only API endpoint.")
    .option("--timeout <ms>", "Request timeout in milliseconds.", parseInteger, 30_000)
    .option("--dry-run", "Show the request that would be sent without calling the API.")
    .option("--yes", "Confirm mutating operations non-interactively.")
    .option("--idempotency-key <key>", "Explicit idempotency key for mutating POST requests.")
    .option("--fresh-idempotency-key", "Generate a fresh idempotency key for this mutation.")
    .option("--verbose", "Write request diagnostics to stderr.")
    .option("--no-color", "Disable color output. Reserved for compatibility; output is colorless by default.");
}

function registerOperationCommands(program: Command): void {
  const groups = new Map<string, Command>([["", program]]);
  for (const definition of CLI_COMMANDS) {
    const parent = ensureGroup(program, groups, definition.path.slice(0, -1));
    const leaf = definition.path.at(-1);
    if (!leaf) continue;
    const command = new Command(leaf).description(definition.description);
    for (const alias of definition.aliases ?? []) command.alias(alias);
    for (const arg of definition.args ?? []) command.argument(arg.syntax, arg.description);
    for (const option of definition.options ?? []) addCommandOption(command, option);
    command.action(async (...values: unknown[]) => {
      const commanderCommand = values.at(-1) as Command;
      const positionals = values.slice(0, -1);
      const localOptions = commanderCommand.opts<Record<string, unknown>>();
      Object.defineProperty(localOptions, "__meta", {
        value: definition.options ?? [],
        enumerable: false
      });
      const args = Object.fromEntries((definition.args ?? []).map((arg, index) => [arg.name, positionals[index]]));
      const invocation = definition.build
        ? await definition.build({
            args,
            options: localOptions,
            globalOptions: program.opts(),
            readStdin
          })
        : defaultInvocation(definition, {
            args,
            options: localOptions,
            globalOptions: program.opts(),
            readStdin
          });
      await executeInvocation(program, invocation);
    });
    parent.addCommand(command);
  }
}

function registerAuthCommands(program: Command): void {
  const auth = new Command("auth").description("Manage local Porkbun credential profiles.");

  auth
    .command("login")
    .description("Save credentials to a named local profile.")
    .option("--profile <profile>", "Profile name. Defaults to the global --profile or default.")
    .option("--api-key <key>", "Porkbun API key.")
    .option("--secret-api-key <key>", "Porkbun secret API key.")
    .action(async (options: Record<string, string | undefined>) => {
      const global = program.opts<Record<string, unknown>>();
      const profile = options.profile ?? stringOption(global.profile) ?? "default";
      const apiKey = options.apiKey ?? stringOption(global.apiKey) ?? process.env.PORKBUN_API_KEY ?? (await promptIfTty("API key: "));
      const secretApiKey =
        options.secretApiKey ??
        stringOption(global.secretApiKey) ??
        process.env.PORKBUN_SECRET_API_KEY ??
        (await promptIfTty("Secret API key: "));
      if (!apiKey || !secretApiKey) {
        throw new CliError({
          kind: "auth",
          message: "auth login requires --api-key/--secret-api-key, env credentials, or an interactive TTY."
        });
      }
      await saveProfile(profile, apiKey, secretApiKey);
      writeData(program, {
        status: "SUCCESS",
        profile,
        configPath: configPath(),
        mode: await configFileMode()
      });
    });

  auth
    .command("logout")
    .description("Delete a saved credential profile.")
    .option("--profile <profile>", "Profile name. Defaults to the global --profile or default.")
    .action(async (options: Record<string, string | undefined>) => {
      const global = program.opts<Record<string, unknown>>();
      const profile = options.profile ?? stringOption(global.profile) ?? "default";
      await deleteProfile(profile);
      writeData(program, { status: "SUCCESS", profile });
    });

  auth
    .command("profiles")
    .description("List saved profiles.")
    .action(async () => {
      const profiles = await listProfiles();
      writeData(program, {
        items: profiles,
        total: profiles.length,
        limit: profiles.length,
        offset: 0
      });
    });

  auth
    .command("whoami")
    .description("Show credential source and validate credentials with ping.")
    .action(async () => {
      const global = program.opts<Record<string, unknown>>();
      const credentials = await resolveCredentials(
        {
          apiKey: stringOption(global.apiKey),
          secretApiKey: stringOption(global.secretApiKey),
          profile: stringOption(global.profile)
        },
        true
      );
      const client = makeClient(global);
      const ping = await client.request(requireOperation("pingGet"));
      writeData(program, {
        status: "SUCCESS",
        source: credentials?.source,
        profile: credentials?.profile,
        ping
      });
    });

  program.addCommand(auth);
}

function registerApiCommands(program: Command): void {
  const api = new Command("api").description("Raw Porkbun API helpers.");

  api
    .command("spec")
    .description("Print the bundled Porkbun OpenAPI spec.")
    .action(async () => {
      writeData(program, await readBundledSpec());
    });

  api
    .command("call")
    .description("Call a Porkbun OpenAPI operation by operationId.")
    .argument("<operationId>", "Porkbun OpenAPI operationId.")
    .option("--param <key=value>", "Path parameter. Repeat for multiple parameters.", collectPair, [])
    .option("--query <key=value>", "Query parameter. Repeat for multiple parameters.", collectPair, [])
    .option("--body <json>", "JSON request body.")
    .option("--body-file <path>", "Read JSON request body from a file.")
    .action(async (operationId: string, options: Record<string, unknown>) => {
      const operation = OPERATIONS_BY_ID.get(operationId);
      if (!operation) {
        throw new CliError({
          kind: "usage",
          message: `Unknown operationId '${operationId}'. Run porkbun schema or porkbun api spec to inspect valid operations.`
        });
      }
      const body = await parseBodyOptions(options);
      await executeInvocation(program, {
        operationId,
        pathParams: pairsToObject(options.param),
        query: pairsToObject(options.query),
        body,
        listKey: operation.listKey
      });
    });

  program.addCommand(api);
}

function registerSchemaCommand(program: Command): void {
  program
    .command("schema")
    .description("Print a clispec v0.1-compatible machine-readable CLI schema.")
    .argument("[command]", "Optional dot-separated command path, for example domains.list.")
    .action((commandPath?: string) => {
      process.stdout.write(`${JSON.stringify(buildCliSchema(commandPath))}\n`);
    });
}

function registerTuiCommand(program: Command): void {
  const tui = new Command("tui")
    .description("Launch the interactive terminal user interface (TUI). Requires a TTY.")
    .action(async () => {
      const global = program.opts<Record<string, unknown>>();
      rejectTuiIncompatibleOptions(global);
      if (!process.stdin.isTTY || !process.stdout.isTTY) {
        throw new CliError({
          kind: "usage",
          message: "porkbun tui requires an interactive terminal (TTY). Use named commands for non-interactive usage."
        });
      }
      await launchTui({
        apiKey: stringOption(global.apiKey),
        secretApiKey: stringOption(global.secretApiKey),
        profile: stringOption(global.profile),
        baseUrl: stringOption(global.baseUrl),
        ipv4: Boolean(global.ipv4),
        timeout: numberOption(global.timeout),
        verbose: Boolean(global.verbose),
        noColor: Boolean(global.color) === false
      });
    });

  program.addCommand(tui);
}

function registerRootAction(program: Command): void {
  program.action(async () => {
    const global = program.opts<Record<string, unknown>>();
    rejectTuiIncompatibleOptions(global);

    if (process.stdin.isTTY && process.stdout.isTTY) {
      await launchTui({
        apiKey: stringOption(global.apiKey),
        secretApiKey: stringOption(global.secretApiKey),
        profile: stringOption(global.profile),
        baseUrl: stringOption(global.baseUrl),
        ipv4: Boolean(global.ipv4),
        timeout: numberOption(global.timeout),
        verbose: Boolean(global.verbose),
        noColor: Boolean(global.color) === false
      });
    } else {
      // Non-TTY: print concise help, exit successfully
      process.stdout.write(`${program.helpInformation()}\n`);
    }
  });
}

const TUI_INCOMPATIBLE_OPTIONS = ["output", "fields", "limit", "offset", "dryRun", "yes", "idempotencyKey", "freshIdempotencyKey"] as const;

function rejectTuiIncompatibleOptions(global: Record<string, unknown>): void {
  for (const key of TUI_INCOMPATIBLE_OPTIONS) {
    const value = global[key];
    // Only reject if the value was explicitly provided (not default)
    if (value !== undefined && value !== false && value !== "auto") {
      // Check if it's a default value
      if (key === "output" && value === "auto") continue;
      throw new CliError({
        kind: "usage",
        message: `Option --${camelToKebab(key)} is not compatible with the interactive TUI.`
      });
    }
  }
}

function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

async function executeInvocation(program: Command, invocation: OperationInvocation): Promise<void> {
  const operation = requireOperation(invocation.operationId);
  const global = program.opts<Record<string, unknown>>();
  await confirmMutation(operation, global);
  const client = makeClient(global);
  const raw = await client.request(operation, {
    pathParams: invocation.pathParams,
    query: invocation.query,
    body: invocation.body,
    dryRun: Boolean(global.dryRun),
    idempotencyKey: stringOption(global.idempotencyKey),
    freshIdempotencyKey: Boolean(global.freshIdempotencyKey)
  });
  const data = normalizeForOutput(raw, {
    listKey: invocation.listKey ?? operation.listKey,
    fields: stringOption(global.fields),
    limit: numberOption(global.limit),
    offset: numberOption(global.offset)
  });
  writeData(program, data, false);
}

function makeClient(global: Record<string, unknown>): ApiClient {
  return new ApiClient({
    apiKey: stringOption(global.apiKey),
    secretApiKey: stringOption(global.secretApiKey),
    profile: stringOption(global.profile),
    baseUrl: stringOption(global.baseUrl),
    ipv4: Boolean(global.ipv4),
    timeoutMs: numberOption(global.timeout),
    verbose: Boolean(global.verbose)
  });
}

function writeData(program: Command, data: unknown, applyFields = true): void {
  const global = program.opts<Record<string, unknown>>();
  process.stdout.write(
    render(data, {
      output: stringOption(global.output),
      fields: applyFields ? stringOption(global.fields) : undefined,
      stdoutIsTty: Boolean(process.stdout.isTTY)
    })
  );
}

async function confirmMutation(operation: OperationDefinition, global: Record<string, unknown>): Promise<void> {
  if (!operation.mutating || global.dryRun || global.yes) return;
  if (!process.stdin.isTTY) {
    throw new CliError({
      kind: "usage",
      message: "Mutating commands require --yes in non-TTY contexts. Use --dry-run to preview the request."
    });
  }
  const answer = await promptIfTty(`Proceed with mutating operation ${operation.operationId}? Type yes: `);
  if (answer !== "yes") {
    throw new CliError({ kind: "usage", message: "Mutation cancelled." });
  }
}

function ensureGroup(root: Command, groups: Map<string, Command>, path: string[]): Command {
  let current = root;
  const parts: string[] = [];
  for (const part of path) {
    parts.push(part);
    const key = parts.join(".");
    let next = groups.get(key);
    if (!next) {
      next = new Command(part).description(`${part} commands.`);
      current.addCommand(next);
      groups.set(key, next);
    }
    current = next;
  }
  return current;
}

function addCommandOption(command: Command, option: CommandOptionDefinition): void {
  const parser = parserFor(option) as ((value: string, previous: unknown) => unknown) | undefined;
  if (option.required) {
    if (parser) command.requiredOption(option.flags, option.description, parser);
    else command.requiredOption(option.flags, option.description);
    return;
  }
  if (parser) {
    const defaultValue = option.defaultValue ?? (option.repeat ? [] : undefined);
    command.option(option.flags, option.description, parser, defaultValue);
  } else {
    command.option(option.flags, option.description, option.defaultValue as string | boolean | string[] | undefined);
  }
}

function parserFor(option: CommandOptionDefinition) {
  switch (option.parser) {
    case "integer":
      return parseInteger;
    case "stringArray":
      return collectStringArray;
    case "json":
      return parseJsonOption;
    default:
      return undefined;
  }
}

function parseInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || String(parsed) !== String(value).trim()) {
    throw new InvalidArgumentError(`Expected an integer, got '${value}'.`);
  }
  return parsed;
}

function collectStringArray(value: string, previous: string[] = []): string[] {
  return [...previous, ...value.split(",").map((entry) => entry.trim()).filter(Boolean)];
}

function collectPair(value: string, previous: string[] = []): string[] {
  if (!value.includes("=")) {
    throw new InvalidArgumentError("Expected key=value.");
  }
  return [...previous, value];
}

function parseJsonOption(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new InvalidArgumentError("Expected valid JSON.");
  }
}

async function parseBodyOptions(options: Record<string, unknown>): Promise<Record<string, unknown>> {
  const bodyText = options.bodyFile
    ? await readFile(String(options.bodyFile), "utf8")
    : typeof options.body === "string"
      ? options.body
      : undefined;
  if (!bodyText) return {};
  const parsed = parseJsonOption(bodyText);
  if (!isRecord(parsed)) {
    throw new CliError({ kind: "usage", message: "--body and --body-file must contain a JSON object." });
  }
  return parsed;
}

function pairsToObject(value: unknown): Record<string, unknown> {
  if (!Array.isArray(value)) return {};
  const result: Record<string, unknown> = Object.create(null);
  for (const pair of value) {
    const [key, ...rest] = String(pair).split("=");
    if (!key || key === "__proto__" || key === "prototype" || key === "constructor") {
      throw new InvalidArgumentError(`Unsupported parameter key '${key}'.`);
    }
    const parsedValue = parseScalar(rest.join("="));
    const existing = result[key];
    if (existing === undefined) result[key] = parsedValue;
    else if (Array.isArray(existing)) existing.push(parsedValue);
    else result[key] = [existing, parsedValue];
  }
  return result;
}

function parseScalar(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return Number.parseFloat(value);
  return value;
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    throw new CliError({ kind: "usage", message: "No stdin data is available." });
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function promptIfTty(prompt: string): Promise<string | undefined> {
  if (!process.stdin.isTTY) return undefined;
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    return await rl.question(prompt);
  } finally {
    rl.close();
  }
}

async function readBundledSpec(): Promise<unknown> {
  const specPath = new URL("./generated/openapi.json", import.meta.url);
  return JSON.parse(await readFile(specPath, "utf8"));
}

function stringOption(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberOption(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await run();
}
