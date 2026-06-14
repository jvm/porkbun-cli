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

## Project Conventions

- **Node ≥ 24** is required (see `engines.node` in `package.json`). CI tests on 24 and 26.
- **Tests** use `node --test` against the compiled `dist/` output. Run `npm test` (it builds first) — don't invoke `node --test` directly.
- **Lint** is `npm run lint` (eslint + typescript-eslint recommended + eslint-plugin-security recommended). The codebase is currently lint-clean; run lint before opening a PR.
- **PRs are squash-merged** from feature branches to keep `main` linear. One commit per finding/area keeps history reviewable.
- **For Porkbun API details**, read `src/generated/openapi.json` (the bundled spec) before trusting third-party SDK docs. The TUI review caught a case where an external SDK's docs were out of date — the bundled spec is authoritative.
- **The TUI** (`src/tui/`) is a separate concern from the CLI (`src/cli.ts`). They share `src/lib/` and `src/types.ts`. Prefer small focused PRs per area.
- **Schema-first design**: `src/lib/operations.ts` defines every API operation as a typed `OperationDefinition`; the TUI and CLI both consume it. When adding an API operation, update operations.ts and the OpenAPI spec first.

## Code Style

- **Dynamic-key collections** use `Map<K, V>` instead of `Record<K, V>`. `eslint-plugin-security` flags bracket writes/reads on plain objects.
- **State-indexed array access** uses `arr.at(i)` instead of `arr[i]`.
- **Single dynamic reads** on plain objects use `Reflect.get(obj, key)`.
- **fs operations on dynamic paths** are per-line disabled with a one-line justification (`// eslint-disable-next-line security/detect-non-literal-fs-filename` followed by why the call is safe). No blanket disable.
- **`as any` and `theme: any` are not allowed.** Type casts should narrow to a structural shape; props should use the actual interface (`Theme` from `src/tui/theme.ts`).
