# Repository Agent Guidelines

This file is the single source of truth for agent (and human) conventions in
this repo. A common jvm-OSS standard applies to all six public Node repos
under `github.com/jvm`; the standard is reproduced below. **Per-repo notes
follow** the common corpus; per-repo notes never override the standard —
they add to it.

## Standard jvm-OSS conventions (applies to all repos)

### Stack

- **Runtime:** Node.js 24+ (tested on Node 24.x and Node 26.x in CI)
- **Package manager:** pnpm 11.x, pinned via `packageManager` in `package.json`
- **Module system:** ESM (`"type": "module"`)
- **Language:** TypeScript `^6.0` (current `latest`; matches `porkbun-cli`)
- **Test framework:** vitest (`pnpm test` = `vitest run`, `pnpm test:watch` = `vitest`)
- **Build:** `tsc` (run via `pnpm build`)
- **Lint:** ESLint 10 flat config (`pnpm lint` = `eslint .`)
- **Format:** Prettier (`pnpm format` = `prettier --write .`, `pnpm format:check` = `prettier --check .`)

### Dev commands

All commands use pnpm.

| Command                   | Purpose                                                             |
| ------------------------- | ------------------------------------------------------------------- |
| `pnpm install`            | Install deps (uses `pnpm-lock.yaml`)                                |
| `pnpm lint`               | Run ESLint                                                          |
| `pnpm format`             | Format with Prettier                                                |
| `pnpm format:check`       | Verify formatting (used in CI)                                      |
| `pnpm typecheck`          | `tsc --noEmit`                                                      |
| `pnpm test`               | Run vitest once                                                     |
| `pnpm test:watch`         | Run vitest in watch mode                                            |
| `pnpm build`              | Compile to `dist/` via `tsc`                                        |
| `pnpm audit`              | `npm audit --omit=dev --audit-level=high`                           |
| `pnpm verify-pack`        | `npm pack --dry-run`                                                |
| `pnpm validate`           | lint + format:check + typecheck + test + build + audit              |
| `pnpm security:secrets`   | betterleaks on the working tree (full scan)                         |
| `pnpm security:scripts`   | shellcheck on `*.sh` (skipped if shellcheck not on PATH)            |
| `pnpm security:workflows` | actionlint on `.github/workflows/*.yml` (skipped if not on PATH)    |
| `pnpm security:local`     | audit + secrets + scripts + workflows (opt-in, full local security) |

### Code style

- **Dynamic-key collections** use `Map<K, V>`, not `Record<K, V>`. ESLint's
  security plugin flags bracket writes/reads on plain objects.
- **Non-literal array indexing** uses `arr.at(i)`, not `arr[i]`.
- **Single dynamic property reads** on a plain object use `Reflect.get(obj, key)`.
- **`as any` is not allowed** unless wrapped in a one-line justification
  (`// eslint-disable-next-line @typescript-eslint/no-explicit-any — <why>`).
- **No blanket `eslint-disable` files.** Disables are per-line with a
  justification.
- ESM imports in `.ts` source use explicit `.js` extensions (e.g.,
  `import { foo } from "./bar.js"`), because `module: NodeNext` resolves
  them at build time.

### Security and CI

- **Local security layer:** `.lefthook.yml` enforces on every commit (betterleaks
  on staged files, prettier check, typecheck if TS files staged) and on every
  push (`pnpm validate`). `pnpm install` brings the `lefthook` binary in; the
  developer runs `pnpm exec lefthook install` once per clone to install the
  git hooks. CI is the source of truth; hooks are a fast feedback loop, not
  a guarantee.
- **Secret scan:** betterleaks on every PR and push (`security.yml`).
- **CodeQL:** weekly + on PRs that touch `src/**` (`security.yml`).
- **Dependency audit:** `npm audit --omit=dev --audit-level=high` on every
  PR (`ci.yml`). Use npm (not pnpm) for the registry talk so the
  vulnerability database is the authoritative source.
- **Trusted publishing (OIDC) for npm** — never commit an `NPM_TOKEN`
  secret.
- **All GitHub Actions are pinned by SHA**, with a comment showing the
  version (e.g., `# v6.0.2`). Update SHAs in a dedicated PR, not in
  feature PRs.
- **Dependabot** is enabled for both `npm` and `github-actions`
  ecosystems; minor/patch are auto-merged only after CI is green.
- **Branch protection** (set in repo settings, not in code) requires
  `ci` and `security` to pass.

### Commit and PR conventions

- Imperative-mood subject ("Add X", not "Added X").
- One logical change per commit. Multi-area changes split into multiple
  commits in one PR is OK; one commit with mixed concerns is not.
- Branch from `main`. Use descriptive branch names
  (`feat/...`, `fix/...`, `chore/...`, `docs/...`).
- No `--force` to shared branches. Force-with-lease is OK for feature
  branches you own.
- No unrelated file churn in a feature PR (e.g., don't reformat
  unrelated files).
- Run `pnpm validate` before opening a PR. CI re-runs it anyway;
  catching it locally saves a round-trip.

## Per-repo notes: porkbun-cli

### Purpose

Use `porkbun` as a structured, non-interactive CLI for Porkbun API v3 tasks.

### Agent Usage Rules

- Prefer env credentials: `PORKBUN_API_KEY` and `PORKBUN_SECRET_API_KEY`.
- Prefer `-o json` for single responses and `-o ndjson` for record streams.
- Run `porkbun schema` to discover commands instead of scraping help text.
- Run `porkbun api spec` when exact Porkbun API request/response details are needed.
- Use `--fields`, `--limit`, and `--offset` on list commands to keep output bounded.
- Use `--dry-run -o json` before mutations when planning or verifying payloads.
- Use `--yes` for intentional non-interactive mutations.
- Do not parse human table output in automation.
- Do not send secrets in command flags when env vars are available.

### Common Commands

```sh
porkbun ping test -o json
porkbun domains list --fields domain,expireDate,autoRenew --limit 20 -o json
porkbun dns records list example.com --fields id,name,type,content -o ndjson
porkbun dns records create example.com --type A --name www --content 203.0.113.10 --ttl 600 --dry-run -o json
porkbun api call getDomain --param domain=example.com -o json
```

### Safety

Mutating commands fail in non-TTY contexts unless `--yes` or `--dry-run` is provided. Mutating POST requests use deterministic idempotency keys by default so retries of the same request are safe.

### Project Conventions

- **Node ≥ 24** is required (see `engines.node` in `package.json`). CI tests on 24 and 26.
- **Tests** use `vitest` (the standard jvm-OSS test runner). Run `pnpm test` (no build needed — vitest exercises `src/` directly). `pnpm test:watch` for the dev loop.
- **Lint** is `pnpm lint` (ESLint 10 flat config + typescript-eslint recommended + eslint-plugin-security recommended on `src/**` only). The codebase is currently lint-clean; run lint before opening a PR.
- **PRs are squash-merged** from feature branches to keep `main` linear. One commit per finding/area keeps history reviewable.
- **For Porkbun API details**, read `src/generated/openapi.json` (the bundled spec) before trusting third-party SDK docs. The TUI review caught a case where an external SDK's docs were out of date — the bundled spec is authoritative.
- **The TUI** (`src/tui/`) is a separate concern from the CLI (`src/cli.ts`). They share `src/lib/` and `src/types.ts`. Prefer small focused PRs per area.
- **Schema-first design**: `src/lib/operations.ts` defines every API operation as a typed `OperationDefinition`; the TUI and CLI both consume it. When adding an API operation, update operations.ts and the OpenAPI spec first.

### Code Style

- **Dynamic-key collections** use `Map<K, V>` instead of `Record<K, V>`. `eslint-plugin-security` flags bracket writes/reads on plain objects.
- **State-indexed array access** uses `arr.at(i)` instead of `arr[i]`.
- **Single dynamic reads** on plain objects use `Reflect.get(obj, key)`.
- **fs operations on dynamic paths** are per-line disabled with a one-line justification (`// eslint-disable-next-line security/detect-non-literal-fs-filename` followed by why the call is safe). No blanket disable.
- **`as any` and `theme: any` are not allowed.** Type casts should narrow to a structural shape; props should use the actual interface (`Theme` from `src/tui/theme.ts`).
