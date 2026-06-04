# Porkbun CLI

Use this skill when managing Porkbun domains, DNS, SSL certificates, account info, marketplace listings, or API keys from a terminal.

## Setup

Prefer environment variables for agent runs:

```sh
export PORKBUN_API_KEY=pk1_...
export PORKBUN_SECRET_API_KEY=sk1_...
```

Install or run:

```sh
npx porkbun-cli --help
```

## Discovery

Always inspect the machine-readable schema when unsure:

```sh
porkbun schema -o json
porkbun schema domains.list -o json
porkbun api spec -o json
```

## Output

Use structured output:

```sh
porkbun domains list --fields domain,expireDate,autoRenew --limit 20 -o json
porkbun dns records list example.com --fields id,name,type,content -o ndjson
```

Data is stdout. Errors are structured JSON on stderr.

## Mutations

Preview first:

```sh
porkbun dns records create example.com --type A --name www --content 203.0.113.10 --ttl 600 --dry-run -o json
```

Execute only when intended:

```sh
porkbun dns records create example.com --type A --name www --content 203.0.113.10 --ttl 600 --yes -o json
```

Mutating commands require `--yes` in non-TTY contexts and automatically attach idempotency keys.
