import { CLI_COMMANDS, type CliCommandDefinition } from "../commands/definitions.js";
import { OPERATIONS, OPERATIONS_BY_ID, type FieldDefinition } from "./operations.js";

interface SchemaCommand {
  name: string;
  description?: string;
  mutating?: boolean;
  stability?: "stable" | "beta" | "experimental" | "deprecated";
  args?: Array<Record<string, unknown>>;
  output_fields?: FieldDefinition[];
  subcommands?: SchemaCommand[];
}

const GLOBAL_ARGS = [
  { name: "--output", type: "string", enum: ["table", "json", "ndjson", "yaml"], required: false },
  { name: "--fields", type: "string", required: false },
  { name: "--limit", type: "integer", required: false, default: 100 },
  { name: "--offset", type: "integer", required: false, default: 0 },
  { name: "--profile", type: "string", required: false },
  { name: "--api-key", type: "string", required: false },
  { name: "--secret-api-key", type: "string", required: false },
  { name: "--base-url", type: "string", required: false },
  { name: "--ipv4", type: "boolean", required: false },
  { name: "--timeout", type: "integer", required: false, default: 30000 },
  { name: "--dry-run", type: "boolean", required: false },
  { name: "--yes", type: "boolean", required: false },
  { name: "--idempotency-key", type: "string", required: false },
  { name: "--fresh-idempotency-key", type: "boolean", required: false },
];

export function buildCliSchema(commandPath?: string): Record<string, unknown> {
  const commands: SchemaCommand[] = [];
  for (const definition of CLI_COMMANDS) addDefinition(commands, definition);
  addStaticCommands(commands);

  return {
    clispec: "0.1",
    name: "porkbun",
    version: "0.1.1",
    description: "Agent-friendly CLI for the Porkbun API v3.",
    commands: commandPath
      ? filterCommands(commands, commandPath.split(".").filter(Boolean))
      : commands,
    errors: [
      { kind: "usage", retryable: false, description: "Invalid CLI usage or malformed input." },
      { kind: "auth", retryable: false, description: "Credentials are missing or invalid." },
      {
        kind: "validation",
        retryable: false,
        description: "The API rejected a malformed or unavailable resource.",
      },
      {
        kind: "not_found",
        retryable: false,
        description: "The requested resource does not exist.",
      },
      {
        kind: "conflict",
        retryable: false,
        description: "The request conflicts with existing state or idempotency constraints.",
      },
      { kind: "rate_limit", retryable: true, description: "Porkbun rate limits were exceeded." },
      { kind: "network", retryable: true, description: "The network request failed." },
      { kind: "timeout", retryable: true, description: "The network request timed out." },
      {
        kind: "api_error",
        retryable: false,
        description: "An API error not covered by a more specific kind.",
      },
    ],
    x_global_args: GLOBAL_ARGS,
    x_operation_ids: OPERATIONS.map((operation) => operation.operationId),
  };
}

function addDefinition(root: SchemaCommand[], definition: CliCommandDefinition): void {
  let level = root;
  for (const [index, part] of definition.path.entries()) {
    let command = level.find((entry) => entry.name === part);
    if (!command) {
      command = { name: part, subcommands: [] };
      level.push(command);
    }
    if (index === definition.path.length - 1) {
      const operation = OPERATIONS_BY_ID.get(definition.operationId);
      command.description = definition.description;
      command.mutating = operation?.mutating ?? false;
      command.stability = "stable";
      command.args = [
        ...(definition.args ?? []).map((arg) => ({
          name: arg.syntax,
          type: arg.type,
          required: arg.syntax.startsWith("<"),
          description: arg.description,
        })),
        ...(definition.options ?? []).map((option) => ({
          name: option.flags.split(/[ ,]+/)[0],
          type: option.type,
          required: option.required ?? false,
          description: option.description,
        })),
      ];
      command.output_fields = operation?.outputFields ?? [];
    }
    level = command.subcommands ?? (command.subcommands = []);
  }
}

function addStaticCommands(root: SchemaCommand[]): void {
  addStatic(root, ["auth", "login"], "Save Porkbun credentials to a named local profile.", true, [
    { name: "--profile", type: "string", required: false },
    { name: "--api-key", type: "string", required: false },
    { name: "--secret-api-key", type: "string", required: false },
  ]);
  addStatic(root, ["auth", "logout"], "Delete a saved profile.", true, [
    { name: "--profile", type: "string", required: false },
  ]);
  addStatic(root, ["auth", "profiles"], "List saved profiles.", false, []);
  addStatic(
    root,
    ["auth", "whoami"],
    "Show credential source and validate credentials with ping.",
    false,
    [],
  );
  addStatic(root, ["api", "call"], "Call a Porkbun OpenAPI operation by operationId.", false, [
    { name: "operationId", type: "string", required: true },
    { name: "--param", type: "string[]", required: false },
    { name: "--query", type: "string[]", required: false },
    { name: "--body", type: "string", required: false },
  ]);
  addStatic(root, ["api", "spec"], "Print the bundled Porkbun OpenAPI spec.", false, []);
  addStatic(root, ["schema"], "Print the CLI schema.", false, [
    { name: "command", type: "string", required: false },
  ]);
}

function addStatic(
  root: SchemaCommand[],
  path: string[],
  description: string,
  mutating: boolean,
  args: Array<Record<string, unknown>>,
): void {
  let level = root;
  for (const [index, part] of path.entries()) {
    let command = level.find((entry) => entry.name === part);
    if (!command) {
      command = { name: part, subcommands: [] };
      level.push(command);
    }
    if (index === path.length - 1) {
      command.description = description;
      command.mutating = mutating;
      command.stability = "stable";
      command.args = args;
      command.output_fields = [];
    }
    level = command.subcommands ?? (command.subcommands = []);
  }
}

function filterCommands(commands: SchemaCommand[], path: string[]): SchemaCommand[] {
  if (path.length === 0) return commands;
  const [head, ...tail] = path;
  const command = commands.find((entry) => entry.name === head);
  if (!command) return [];
  if (tail.length === 0) return [command];
  return [
    {
      ...command,
      subcommands: filterCommands(command.subcommands ?? [], tail),
    },
  ];
}
