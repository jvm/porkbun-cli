import type { OperationDefinition } from "../lib/operations.js";
import { CliError } from "../lib/errors.js";

export type OptionParser = "integer" | "stringArray" | "json";
export type Target = "path" | "query" | "body";

export interface CommandArgDefinition {
  name: string;
  syntax: string;
  description: string;
  type: string;
  target?: Target;
  key?: string;
}

export interface CommandOptionDefinition {
  name: string;
  flags: string;
  description: string;
  type: string;
  target?: Target;
  key?: string;
  parser?: OptionParser;
  required?: boolean;
  repeat?: boolean;
  defaultValue?: unknown;
}

export interface BuildContext {
  args: Record<string, unknown>;
  options: Record<string, unknown>;
  globalOptions: Record<string, unknown>;
  readStdin: () => Promise<string>;
}

export interface OperationInvocation {
  operationId: string;
  pathParams?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  listKey?: string;
}

export interface CliCommandDefinition {
  path: string[];
  description: string;
  operationId: string;
  aliases?: string[];
  args?: CommandArgDefinition[];
  options?: CommandOptionDefinition[];
  listKey?: string;
  build?: (context: BuildContext) => OperationInvocation | Promise<OperationInvocation>;
}

const domainArg: CommandArgDefinition = {
  name: "domain",
  syntax: "<domain>",
  description: "Domain name, such as example.com.",
  type: "string",
  target: "path",
};

const subdomainArg: CommandArgDefinition = {
  name: "subdomain",
  syntax: "<subdomain>",
  description: "Subdomain label, such as ns1 or www.",
  type: "string",
  target: "path",
};

const optionalSubdomainArg: CommandArgDefinition = {
  name: "subdomain",
  syntax: "[subdomain]",
  description: "Subdomain label. Use an empty value for the root record.",
  type: "string",
  target: "path",
};

const idArg: CommandArgDefinition = {
  name: "id",
  syntax: "<id>",
  description: "Porkbun record or forwarding ID.",
  type: "string",
  target: "path",
};

const costOption: CommandOptionDefinition = {
  name: "cost",
  flags: "--cost <pennies>",
  description: "Expected cost in pennies, for example 973 for $9.73.",
  type: "integer",
  target: "body",
  parser: "integer",
  required: true,
};

const dnsWriteOptions: CommandOptionDefinition[] = [
  {
    name: "type",
    flags: "--type <type>",
    description: "DNS record type, such as A, AAAA, CNAME, MX, TXT, or SRV.",
    type: "string",
    target: "body",
    required: true,
  },
  {
    name: "content",
    flags: "--content <value>",
    description: "DNS record value.",
    type: "string",
    target: "body",
    required: true,
  },
  {
    name: "name",
    flags: "--name <name>",
    description: "Record name or subdomain. Omit for root where Porkbun accepts that.",
    type: "string",
    target: "body",
  },
  {
    name: "ttl",
    flags: "--ttl <seconds>",
    description: "DNS TTL in seconds.",
    type: "integer",
    target: "body",
    parser: "integer",
  },
  {
    name: "prio",
    flags: "--prio <priority>",
    description: "Priority for MX and SRV records.",
    type: "integer",
    target: "body",
    parser: "integer",
  },
  {
    name: "notes",
    flags: "--notes <text>",
    description: "Optional Porkbun record notes.",
    type: "string",
    target: "body",
  },
];

const dnsEditByNameTypeOptions: CommandOptionDefinition[] = dnsWriteOptions.filter(
  (option) => option.name !== "type" && option.name !== "name",
);

export const CLI_COMMANDS: CliCommandDefinition[] = [
  {
    path: ["ip", "get"],
    aliases: ["show"],
    operationId: "getIp",
    description: "Get the caller public IP address.",
  },
  {
    path: ["ping", "test"],
    aliases: ["check"],
    operationId: "pingGet",
    description: "Test API connectivity and optionally validate available credentials.",
  },
  {
    path: ["pricing", "get"],
    operationId: "getPricingGet",
    description: "Retrieve public TLD pricing.",
    options: [
      {
        name: "tld",
        flags: "--tld <tld>",
        description: "Limit pricing to a TLD. Repeat or use comma-separated values.",
        type: "string[]",
        parser: "stringArray",
        repeat: true,
      },
    ],
    build: ({ options }) => {
      const tlds = stringArray(options.tld);
      return tlds.length > 0
        ? { operationId: "getPricing", body: { tlds } }
        : { operationId: "getPricingGet" };
    },
  },
  {
    path: ["apikey", "request"],
    operationId: "apikeyRequest",
    description: "Initiate an API key authorization request.",
    options: [
      {
        name: "name",
        flags: "--name <name>",
        description: "Human-readable name for the requested API key.",
        type: "string",
        target: "body",
        required: true,
      },
    ],
  },
  {
    path: ["apikey", "retrieve"],
    operationId: "apikeyRetrieve",
    description: "Poll for an approved API key request.",
    options: [
      {
        name: "requestToken",
        flags: "--request-token <token>",
        description: "Request token returned by apikey request.",
        type: "string",
        target: "body",
        required: true,
      },
    ],
  },
  {
    path: ["account", "balance"],
    operationId: "getBalance",
    description: "Get account credit balance.",
  },
  {
    path: ["account", "settings"],
    operationId: "getApiSettings",
    description: "Get account API spend settings.",
  },
  {
    path: ["account", "invite", "create"],
    operationId: "createAccountInvite",
    description: "Create an account registration invite.",
    options: [
      {
        name: "email",
        flags: "--email <email>",
        description: "Invitee email address.",
        type: "string",
        target: "body",
        required: true,
      },
      {
        name: "returnUrl",
        flags: "--return-url <url>",
        description: "Return URL after invite signup.",
        type: "string",
        target: "body",
        required: true,
      },
    ],
  },
  {
    path: ["account", "invite", "status"],
    operationId: "getAccountInviteStatus",
    description: "Check account invite status.",
  },
  {
    path: ["domains", "list"],
    aliases: ["ls"],
    operationId: "getDomains",
    description: "List domains in the authenticated account.",
    listKey: "domains",
    options: [
      queryOption(
        "start",
        "--start <offset>",
        "API pagination offset.",
        "integer",
        "start",
        "integer",
      ),
      queryOption(
        "includeLabels",
        "--include-labels <yes|no>",
        "Include Porkbun label metadata.",
        "string",
        "includeLabels",
      ),
      queryOption("domain", "--domain <domain>", "Exact domain match.", "string", "domain"),
      queryOption(
        "nameContains",
        "--name-contains <text>",
        "Substring match against domain names.",
        "string",
        "nameContains",
      ),
      queryOption(
        "expiringWithinDays",
        "--expiring-within-days <days>",
        "Filter to domains expiring within N days.",
        "integer",
        "expiringWithinDays",
        "integer",
      ),
      arrayOption(
        "tld",
        "--tld <tld>",
        "Filter to a TLD. Repeat or use comma-separated values.",
        "tlds",
      ),
      queryOption(
        "autoRenew",
        "--auto-renew <yes|no>",
        "Filter by auto-renew status.",
        "string",
        "autoRenew",
      ),
      queryOption(
        "apiAccess",
        "--api-access <yes|no>",
        "Filter by API access status.",
        "string",
        "apiAccess",
      ),
      queryOption("sortName", "--sort-name <field>", "Sort field.", "string", "sortName"),
      queryOption(
        "sortDirection",
        "--sort-direction <asc|desc>",
        "Sort direction.",
        "string",
        "sortDirection",
      ),
    ],
    build: ({ options, globalOptions }) => ({
      operationId: "getDomains",
      query: {
        ...targetOptions(options, "query"),
        start: options.start ?? globalOptions.offset,
      },
      listKey: "domains",
    }),
  },
  {
    path: ["domains", "get"],
    operationId: "getDomain",
    description: "Get a single domain.",
    args: [domainArg],
  },
  {
    path: ["domains", "check"],
    operationId: "domainCheckDomain",
    description: "Check domain availability and pricing.",
    args: [domainArg],
  },
  {
    path: ["domains", "register"],
    operationId: "domainCreate",
    description: "Register a domain using account credit.",
    args: [domainArg],
    options: [
      costOption,
      {
        name: "agreeToTerms",
        flags: "--agree-to-terms <yes|1>",
        description: "Required Porkbun terms agreement value.",
        type: "string",
        target: "body",
        required: true,
      },
    ],
  },
  {
    path: ["domains", "renew"],
    operationId: "domainRenew",
    description: "Renew a domain using account credit.",
    args: [domainArg],
    options: [costOption],
  },
  {
    path: ["domains", "transfer"],
    operationId: "transferDomain",
    description: "Initiate a domain transfer.",
    args: [domainArg],
    options: [
      costOption,
      {
        name: "authCode",
        flags: "--auth-code <code>",
        description: "Registry transfer authorization code.",
        type: "string",
        target: "body",
        required: true,
      },
    ],
  },
  {
    path: ["domains", "transfer-status"],
    operationId: "getTransferGet",
    description: "Get transfer status for a domain.",
    args: [domainArg],
  },
  {
    path: ["domains", "transfers"],
    operationId: "listTransfersGet",
    description: "List active transfers.",
    listKey: "transfers",
  },
  {
    path: ["domains", "auto-renew"],
    operationId: "domainUpdateAutoRenew",
    description: "Update auto-renew for one or more domains.",
    args: [
      {
        name: "domains",
        syntax: "<domains...>",
        description: "One or more domains.",
        type: "string[]",
      },
    ],
    options: [
      {
        name: "status",
        flags: "--status <on|off>",
        description: "Auto-renew status to set.",
        type: "string",
        target: "body",
        required: true,
      },
    ],
    build: ({ args, options }) => {
      const domains = stringArray(args.domains);
      return {
        operationId: "domainUpdateAutoRenew",
        pathParams: { domain: domains[0] },
        body: {
          status: options.status,
          domains: domains.slice(1),
        },
      };
    },
  },
  {
    path: ["domains", "nameservers", "get"],
    operationId: "getDomainNs",
    description: "Get domain nameservers.",
    args: [domainArg],
  },
  {
    path: ["domains", "nameservers", "update"],
    operationId: "domainUpdateNs",
    description: "Update domain nameservers.",
    args: [domainArg],
    options: [
      {
        name: "ns",
        flags: "--ns <nameserver>",
        description: "Nameserver hostname. Repeat for multiple nameservers.",
        type: "string[]",
        target: "body",
        key: "ns",
        parser: "stringArray",
        repeat: true,
        required: true,
      },
    ],
  },
  {
    path: ["domains", "glue", "list"],
    operationId: "getDomainGlue",
    description: "List glue records.",
    args: [domainArg],
    listKey: "records",
  },
  {
    path: ["domains", "glue", "create"],
    operationId: "domainCreateGlue",
    description: "Create a glue record.",
    args: [domainArg, subdomainArg],
    options: [
      bodyArrayOption(
        "ip",
        "--ip <address>",
        "IP address for the glue record. Repeat for multiple addresses.",
        "ips",
        true,
      ),
    ],
  },
  {
    path: ["domains", "glue", "update"],
    operationId: "domainUpdateGlue",
    description: "Update a glue record.",
    args: [domainArg, subdomainArg],
    options: [
      bodyArrayOption(
        "ip",
        "--ip <address>",
        "IP address for the glue record. Repeat for multiple addresses.",
        "ips",
        true,
      ),
    ],
  },
  {
    path: ["domains", "glue", "delete"],
    operationId: "domainDeleteGlue",
    description: "Delete a glue record.",
    args: [domainArg, subdomainArg],
  },
  {
    path: ["domains", "forwards", "list"],
    operationId: "getDomainUrlForwarding",
    description: "List URL forwards.",
    args: [domainArg],
    listKey: "forwards",
  },
  {
    path: ["domains", "forwards", "add"],
    operationId: "domainAddUrlForward",
    description: "Add a URL forward.",
    args: [domainArg],
    options: [
      bodyOption(
        "subdomain",
        "--subdomain <name>",
        "Forward subdomain. Omit for root.",
        "string",
        "subdomain",
      ),
      bodyOption(
        "location",
        "--location <url>",
        "Target URL.",
        "string",
        "location",
        undefined,
        true,
      ),
      bodyOption(
        "type",
        "--type <permanent|temporary>",
        "Redirect type.",
        "string",
        "type",
        undefined,
        true,
      ),
      bodyOption(
        "includePath",
        "--include-path <yes|no>",
        "Whether to include the incoming path.",
        "string",
        "includePath",
        undefined,
        true,
      ),
      bodyOption(
        "wildcard",
        "--wildcard <yes|no>",
        "Whether to include wildcard subdomains.",
        "string",
        "wildcard",
        undefined,
        true,
      ),
    ],
  },
  {
    path: ["domains", "forwards", "delete"],
    operationId: "domainDeleteUrlForward",
    description: "Delete a URL forward.",
    args: [domainArg, idArg],
  },
  {
    path: ["dns", "records", "list"],
    aliases: ["ls"],
    operationId: "getDnsRecords",
    description: "List DNS records for a domain.",
    args: [domainArg],
    listKey: "records",
  },
  {
    path: ["dns", "records", "get"],
    operationId: "getDnsRecordById",
    description: "Get a DNS record by ID.",
    args: [domainArg, idArg],
  },
  {
    path: ["dns", "records", "find"],
    operationId: "getDnsRecordsByNameType",
    description: "Find DNS records by type and subdomain.",
    args: [
      domainArg,
      {
        name: "type",
        syntax: "<type>",
        description: "DNS record type.",
        type: "string",
        target: "path",
      },
      optionalSubdomainArg,
    ],
    listKey: "records",
    build: ({ args }) => ({
      operationId: "getDnsRecordsByNameType",
      pathParams: {
        domain: args.domain,
        type: args.type,
        subdomain: args.subdomain ?? "",
      },
      listKey: "records",
    }),
  },
  {
    path: ["dns", "records", "create"],
    operationId: "dnsCreate",
    description: "Create a DNS record.",
    args: [domainArg],
    options: dnsWriteOptions,
  },
  {
    path: ["dns", "records", "edit"],
    operationId: "dnsEdit",
    description: "Edit a DNS record by ID.",
    args: [domainArg, idArg],
    options: dnsWriteOptions,
  },
  {
    path: ["dns", "records", "edit-by-name-type"],
    operationId: "dnsEditByNameType",
    description: "Edit DNS records by name and type.",
    args: [
      domainArg,
      {
        name: "type",
        syntax: "<type>",
        description: "DNS record type.",
        type: "string",
        target: "path",
      },
      optionalSubdomainArg,
    ],
    options: dnsEditByNameTypeOptions,
    build: ({ args, options }) => ({
      operationId: "dnsEditByNameType",
      pathParams: {
        domain: args.domain,
        type: args.type,
        subdomain: args.subdomain ?? "",
      },
      body: targetOptions(options, "body"),
    }),
  },
  {
    path: ["dns", "records", "delete"],
    operationId: "dnsDelete",
    description: "Delete a DNS record by ID.",
    args: [domainArg, idArg],
  },
  {
    path: ["dns", "records", "delete-by-name-type"],
    operationId: "dnsDeleteByNameType",
    description: "Delete DNS records by name and type.",
    args: [
      domainArg,
      {
        name: "type",
        syntax: "<type>",
        description: "DNS record type.",
        type: "string",
        target: "path",
      },
      optionalSubdomainArg,
    ],
    build: ({ args }) => ({
      operationId: "dnsDeleteByNameType",
      pathParams: {
        domain: args.domain,
        type: args.type,
        subdomain: args.subdomain ?? "",
      },
    }),
  },
  {
    path: ["dns", "dnssec", "list"],
    operationId: "getDnssecRecords",
    description: "List DNSSEC records.",
    args: [domainArg],
    listKey: "records",
  },
  {
    path: ["dns", "dnssec", "create"],
    operationId: "dnsCreateDnssecRecord",
    description: "Create a DNSSEC record.",
    args: [domainArg],
    options: [
      bodyOption(
        "keyTag",
        "--key-tag <keytag>",
        "DNSSEC key tag.",
        "integer",
        "keyTag",
        "integer",
        true,
      ),
      bodyOption(
        "alg",
        "--alg <algorithm>",
        "DNSSEC algorithm.",
        "integer",
        "alg",
        "integer",
        true,
      ),
      bodyOption(
        "digestType",
        "--digest-type <type>",
        "DNSSEC digest type.",
        "integer",
        "digestType",
        "integer",
        true,
      ),
      bodyOption(
        "digest",
        "--digest <digest>",
        "DNSSEC digest.",
        "string",
        "digest",
        undefined,
        true,
      ),
      bodyOption(
        "keyDataFlags",
        "--key-data-flags <flags>",
        "Optional key data flags.",
        "integer",
        "keyDataFlags",
        "integer",
      ),
      bodyOption(
        "keyDataProtocol",
        "--key-data-protocol <protocol>",
        "Optional key data protocol.",
        "integer",
        "keyDataProtocol",
        "integer",
      ),
      bodyOption(
        "keyDataAlgo",
        "--key-data-algo <algorithm>",
        "Optional key data algorithm.",
        "integer",
        "keyDataAlgo",
        "integer",
      ),
      bodyOption(
        "keyDataPubKey",
        "--key-data-pub-key <key>",
        "Optional key data public key.",
        "string",
        "keyDataPubKey",
      ),
      bodyOption(
        "maxSigLife",
        "--max-sig-life <seconds>",
        "Optional max signature life.",
        "integer",
        "maxSigLife",
        "integer",
      ),
    ],
  },
  {
    path: ["dns", "dnssec", "delete"],
    operationId: "dnsDeleteDnssecRecord",
    description: "Delete a DNSSEC record.",
    args: [
      domainArg,
      {
        name: "keytag",
        syntax: "<keytag>",
        description: "DNSSEC key tag.",
        type: "string",
        target: "path",
      },
    ],
  },
  {
    path: ["ssl", "retrieve"],
    operationId: "getSslRetrieve",
    description: "Retrieve a Porkbun SSL certificate bundle.",
    args: [domainArg],
  },
  {
    path: ["email", "set-password"],
    operationId: "emailSetPassword",
    description: "Set an email hosting password.",
    options: [
      bodyOption(
        "emailAddress",
        "--email-address <email>",
        "Full email address.",
        "string",
        "emailAddress",
        undefined,
        true,
      ),
      bodyOption(
        "password",
        "--password <password>",
        "New password. Prefer --password-stdin in scripts.",
        "string",
        "password",
      ),
      {
        name: "passwordStdin",
        flags: "--password-stdin",
        description: "Read the password from stdin.",
        type: "boolean",
      },
    ],
    build: async ({ options, readStdin }) => {
      const password = options.passwordStdin ? (await readStdin()).trimEnd() : options.password;
      if (!password) {
        throw new CliError({
          kind: "usage",
          message: "email set-password requires --password or --password-stdin.",
        });
      }
      return {
        operationId: "emailSetPassword",
        body: {
          emailAddress: options.emailAddress,
          password,
        },
      };
    },
  },
  {
    path: ["marketplace", "list"],
    aliases: ["ls"],
    operationId: "listMarketplaceListingsGet",
    description: "List Porkbun marketplace domains.",
    listKey: "domains",
    options: [
      queryOption(
        "query",
        "--query <text>",
        "Search query. Prefix terms with - to exclude.",
        "string",
        "query",
      ),
      arrayOption(
        "tld",
        "--tld <tld>",
        "Filter to a TLD. Repeat or use comma-separated values.",
        "tlds",
      ),
      queryOption(
        "sldLengthMin",
        "--sld-length-min <n>",
        "Minimum SLD length.",
        "integer",
        "sldLengthMin",
        "integer",
      ),
      queryOption(
        "sldLengthMax",
        "--sld-length-max <n>",
        "Maximum SLD length.",
        "integer",
        "sldLengthMax",
        "integer",
      ),
      queryOption(
        "sortName",
        "--sort-name <field>",
        "Sort field: domain, tld, price, or sld_length.",
        "string",
        "sortName",
      ),
      queryOption(
        "sortDirection",
        "--sort-direction <asc|desc>",
        "Sort direction.",
        "string",
        "sortDirection",
      ),
      queryOption(
        "start",
        "--start <offset>",
        "API pagination offset.",
        "integer",
        "start",
        "integer",
      ),
    ],
    build: ({ options, globalOptions }) => ({
      operationId: "listMarketplaceListingsGet",
      query: {
        ...targetOptions(options, "query"),
        limit: globalOptions.limit,
        start: options.start ?? globalOptions.offset,
      },
      listKey: "domains",
    }),
  },
];

export function defaultInvocation(
  definition: CliCommandDefinition,
  context: BuildContext,
): OperationInvocation {
  return {
    operationId: definition.operationId,
    pathParams: {
      ...targetArgs(definition, context.args, "path"),
      ...targetOptions(context.options, "path"),
    },
    query: targetOptions(context.options, "query"),
    body: {
      ...targetArgs(definition, context.args, "body"),
      ...targetOptions(context.options, "body"),
    },
    listKey: definition.listKey,
  };
}

export function operationOutputFields(operation: OperationDefinition) {
  return operation.outputFields ?? [];
}

export function targetOptions(
  options: Record<string, unknown>,
  target: Target,
): Record<string, unknown> {
  const meta = (options.__meta as CommandOptionDefinition[] | undefined) ?? [];
  return Object.fromEntries(
    meta
      .filter((option) => option.target === target)
      .map((option) => [option.key ?? option.name, normalizeValue(options[option.name])])
      .filter(([, value]) => value !== undefined),
  );
}

function targetArgs(
  definition: CliCommandDefinition,
  args: Record<string, unknown>,
  target: Target,
): Record<string, unknown> {
  return Object.fromEntries(
    (definition.args ?? [])
      .filter((arg) => arg.target === target)
      .map((arg) => [arg.key ?? arg.name, normalizeValue(args[arg.name])])
      .filter(([, value]) => value !== undefined),
  );
}

function queryOption(
  name: string,
  flags: string,
  description: string,
  type: string,
  key = name,
  parser?: OptionParser,
  required = false,
): CommandOptionDefinition {
  return {
    name,
    flags,
    description,
    type,
    target: "query",
    key,
    parser,
    required,
  };
}

function bodyOption(
  name: string,
  flags: string,
  description: string,
  type: string,
  key = name,
  parser?: OptionParser,
  required = false,
): CommandOptionDefinition {
  return {
    name,
    flags,
    description,
    type,
    target: "body",
    key,
    parser,
    required,
  };
}

function arrayOption(
  name: string,
  flags: string,
  description: string,
  key = name,
  required = false,
): CommandOptionDefinition {
  return {
    name,
    flags,
    description,
    type: "string[]",
    target: "query",
    key,
    parser: "stringArray",
    repeat: true,
    required,
  };
}

function bodyArrayOption(
  name: string,
  flags: string,
  description: string,
  key = name,
  required = false,
): CommandOptionDefinition {
  return {
    name,
    flags,
    description,
    type: "string[]",
    target: "body",
    key,
    parser: "stringArray",
    repeat: true,
    required,
  };
}

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    const flat = value.flatMap((entry) => (typeof entry === "string" ? entry.split(",") : [entry]));
    const cleaned = flat
      .map((entry) => (typeof entry === "string" ? entry.trim() : entry))
      .filter((entry) => entry !== "");
    return cleaned.length > 0 ? cleaned : undefined;
  }
  return value === "" ? undefined : value;
}

function stringArray(value: unknown): string[] {
  const normalized = normalizeValue(value);
  if (Array.isArray(normalized)) return normalized.map(String);
  if (typeof normalized === "string")
    return normalized
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  return [];
}
