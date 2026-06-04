# AGENTS.md

## Purpose

Use `porkbun` as a structured, non-interactive CLI for Porkbun API v3 tasks.

## Agent Usage Rules

- Prefer env credentials: `PORKBUN_API_KEY` and `PORKBUN_SECRET_API_KEY`.
- Prefer `-o json` for single responses and `-o ndjson` for record streams.
- Run `porkbun schema` to discover commands instead of scraping help text.
- Run `porkbun api spec` when exact Porkbun API request/response details are needed.
- Use `--fields`, `--limit`, and `--offset` on list commands to keep output bounded.
- Use `--dry-run -o json` before mutations when planning or verifying payloads.
- Use `--yes` for intentional non-interactive mutations.
- Do not parse human table output in automation.
- Do not send secrets in command flags when env vars are available.

## Common Commands

```sh
porkbun ping test -o json
porkbun domains list --fields domain,expireDate,autoRenew --limit 20 -o json
porkbun dns records list example.com --fields id,name,type,content -o ndjson
porkbun dns records create example.com --type A --name www --content 203.0.113.10 --ttl 600 --dry-run -o json
porkbun api call getDomain --param domain=example.com -o json
```

## Safety

Mutating commands fail in non-TTY contexts unless `--yes` or `--dry-run` is provided. Mutating POST requests use deterministic idempotency keys by default so retries of the same request are safe.
