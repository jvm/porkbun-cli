# porkbun-cli

Agent-friendly Node CLI for the Porkbun API v3.

> [!IMPORTANT]
> This is an independent, unofficial project. It is not affiliated with, endorsed by, or maintained by Porkbun LLC. Porkbun and related names and marks belong to their respective owners.

## Install

```sh
npx porkbun-cli --help
npm install -g porkbun-cli
npm install --save-dev porkbun-cli
```

The package exposes the `porkbun` binary.

## Auth

Agents should prefer environment variables:

```sh
export PORKBUN_API_KEY=pk1_...
export PORKBUN_SECRET_API_KEY=sk1_...
porkbun ping test -o json
```

Humans can save a local profile:

```sh
porkbun auth login --profile default
porkbun auth whoami -o json
```

The login command prompts for credentials on an interactive TTY. Profiles are stored in the XDG config directory with `0600` permissions. Avoid passing secrets as command-line flags because they may be retained in shell history or exposed through process listings. Explicit flags override env vars, and env vars override profiles.

## Interactive TUI

Run `porkbun` without arguments in an interactive terminal to launch the TUI:

```sh
porkbun
```

The TUI provides a keyboard-driven interface for managing your Porkbun domain portfolio. If stdin or stdout is not a TTY, `porkbun` prints help and exits (use subcommands for scripting).

### Navigation

- **↑/↓** or **j/k**: Navigate lists
- **Enter**: Open item or submit form
- **Esc** or **q**: Go back or cancel
- **Tab** / **Shift+Tab**: Move between fields
- **Space**: Toggle selection
- **/**: Search
- **r**: Refresh current view
- **Ctrl+C**: Quit

### TUI Features

The TUI supports:

- Domain portfolio browsing with search, filter, and sort
- DNS record management (create, edit, delete)
- Nameserver updates
- Glue record management
- URL forward management
- DNSSEC record management
- SSL certificate bundle retrieval and secure export
- Auto-renew toggles (single or bulk)
- Domain registration, renewal, and transfers
- Account balance and settings

All mutations require review and confirmation. Billable operations (registration, renewal, transfer) require typing the domain name to confirm.

### SSL Export

When viewing an SSL certificate bundle in the TUI, press `e` to export the certificate chain, private key, and public key to a secure directory. The private key is written with `0600` permissions.

## Agent Contract

- Data is written to stdout.
- Diagnostics and structured errors are written to stderr.
- TTY output defaults to tables; piped output defaults to JSON.
- Every command supports `--output table|json|ndjson|yaml`.
- List commands support `--limit`, `--offset`, and `--fields`.
- Mutating commands require `--yes` outside a TTY and support `--dry-run`.
- Mutating POST requests attach deterministic idempotency keys by default.
- `porkbun schema` emits a clispec v0.1-compatible command schema.
- `porkbun api spec` emits the bundled Porkbun OpenAPI spec.

## Examples

```sh
porkbun ip get
porkbun pricing get --tld com --tld io -o json
porkbun domains list --fields domain,expireDate,autoRenew --limit 20 -o json
porkbun domains check example.com -o json
porkbun dns records list example.com --fields id,name,type,content -o ndjson
porkbun dns records create example.com --type A --name www --content 203.0.113.10 --ttl 600 --dry-run -o json
porkbun domains register example.com --cost 973 --agree-to-terms yes --dry-run -o json
porkbun domains register example.com --cost 973 --agree-to-terms yes --yes
```

Raw operation access is available when an agent wants to map directly to the OpenAPI spec:

```sh
porkbun api call getDnsRecords --param domain=example.com -o json
porkbun api call dnsCreate --param domain=example.com --body '{"type":"A","name":"www","content":"203.0.113.10","ttl":600}' --dry-run -o json
```

## Development

```sh
pnpm install
pnpm test
pnpm build
```

A single `pnpm validate` runs the full pipeline (lint + format:check + typecheck + test + build + audit); use it before opening a PR. `pnpm exec lefthook install` (one-time per clone) wires up the pre-commit and pre-push hooks so secrets, formatting, and the full validation gate run locally before CI.

The test suite includes config/auth precedence, output formatting, request construction, error mapping, CLI integration, and a contract check that every bundled OpenAPI `operationId` is represented in the operation registry.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and pull request guidance. Please report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## License

The project implementation is licensed under the MIT License. The bundled Porkbun OpenAPI document is third-party material and is not covered by this project's MIT grant; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
