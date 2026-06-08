# PLAN: Porkbun Terminal User Interface

This plan is an ordered todo list for implementing `docs/PRD-tui.md` on the current `feature/tui` branch. Keep the checkboxes up to date as work progresses. The implementing agent should have the current source tree, the PRD, and this plan; no website scraping or browser automation is part of the implementation.

1. [ ] Establish implementation guardrails before changing code.
   1. [ ] Re-read `docs/PRD-tui.md` and treat its `TUI-*` requirement IDs as normative.
   2. [ ] Preserve the existing non-interactive CLI contract: structured stdout, JSON error envelopes on stderr, existing command paths, mutation `--yes`/`--dry-run` behavior, deterministic idempotency keys, and credential-origin checks.
   3. [ ] Use `npm` for dependency and script changes because the repo already has `package-lock.json`; do not introduce another package manager.
   4. [ ] Keep TUI implementation optional at runtime: named non-TUI commands must not import/render Ink or emit terminal control sequences.
   5. [ ] Do not persist API responses, domain lists, form drafts, transfer auth codes, email passwords, SSL private keys, or activity history to disk except for explicit SSL export and explicit result-summary export.
   6. [ ] Keep all credentials and sensitive values out of rendered UI snapshots, error details, verbose logs, status lines, and review screens.
   7. [ ] Use only operations in `src/lib/operations.ts` and the bundled OpenAPI spec. If a needed documented API operation is missing, add it to the shared operation layer first so CLI and TUI remain consistent.
   8. [ ] Track PRD section 23 open questions as phase gates and resolve each before its phase begins: Q1 select-all completeness (handled in steps 13.3/14.10), Q2 `includeLabels` label shape stability (add a probe/validation before relying on label display/filter in step 13.1), Q3 premium-TLD renewal/transfer price reliability from `domainCheckDomain` (validate before enabling billable submit in steps 25/26), Q4 SSL export path (explicit path chosen in 27.3), Q5 optional-dependency/package-size decision (decide from spike measurements in 4.10), Q6 native-vs-composed bulk semantics (28.9), and Q7 accessible mode (see 32.11). Record each resolution in the implementation PR.

2. [ ] Record current source facts that shape the implementation.
   1. [ ] `src/cli.ts` builds the Commander program, registers generated/static commands, resolves global options, creates `ApiClient`, and calls operation definitions directly.
   2. [ ] `src/lib/api-client.ts` owns credential resolution, base URL validation, auth placement, request execution, idempotency key generation, dry-run previews, verbose request logging, response parsing, and `CliError` mapping.
   3. [ ] `src/lib/config.ts` owns profile storage, profile listing, credential precedence, and config-file permissions.
   4. [ ] `src/lib/operations.ts` is the operation registry. Prefer GET/header-auth operation IDs for TUI reads where available; use POST/body-auth operations for mutations.
   5. [ ] `src/commands/definitions.ts` documents the existing CLI request shapes and is useful as a reference, but the TUI must not shell out to the CLI or use CLI command definitions as its state model.
   6. [ ] `src/lib/output.ts` has redaction helpers for CLI previews; add UI-specific redaction/sanitization rather than assuming table output is safe for terminal rendering.
   7. [ ] Current tests import built files from `dist`; update `tsconfig.json`, build output, and tests consistently when adding `.tsx` files.

3. [ ] Use this API operation map throughout the TUI service layer.

   | Workflow | Operation ID(s) | Notes for TUI |
   | --- | --- | --- |
   | Ping/auth validation | `pingGet` | Optional-auth GET; use to validate startup credentials. |
   | Domain list | `getDomains` | Query supports `start`, `includeLabels`, `domain`, `nameContains`, `expiringWithinDays`, `tlds[]`, `autoRenew`, `apiAccess`, `sortName`, `sortDirection`; returns up to 1000 domains per call and `count`, but no guaranteed total. |
   | Domain detail | `getDomain` | Query `includeLabels=yes`; response wraps detail in `domain`. |
   | Auto-renew | `domainUpdateAutoRenew` | Body `status: on|off`, optional `domains[]`; response may include per-domain `results`. |
   | Nameservers | `getDomainNs`, `domainUpdateNs` | Read returns ordered `ns[]`; write body `ns[]`. |
   | Glue | `getDomainGlue`, `domainCreateGlue`, `domainUpdateGlue`, `domainDeleteGlue` | Read shape is `hosts` as `[hostname, {v4: [], v6: []}]` tuples; write body `ips[]`. |
   | URL forwarding | `getDomainUrlForwarding`, `domainAddUrlForward`, `domainDeleteUrlForward` | No API edit operation; replace means delete + add. |
   | DNS records | `getDnsRecords`, `getDnsRecordById`, `getDnsRecordsByNameType`, `dnsCreate`, `dnsEdit`, `dnsEditByNameType`, `dnsDelete`, `dnsDeleteByNameType` | Default edit/delete by ID. Name/type bulk variants require strong review copy. |
   | Registry DNSSEC | `getDnssecRecords`, `dnsCreateDnssecRecord`, `dnsDeleteDnssecRecord` | Read `records` may be an object keyed by key tag; normalize to array. |
   | SSL bundle | `getSslRetrieve` | Fetch only after explicit action; never render private key or full cert material. |
   | Availability/pricing | `domainCheckDomain` | Source of registration price and, when present, renewal/transfer prices in `response.additional`. |
   | Register | `domainCreate` | Billable; body `cost`, `agreeToTerms` only after strong confirmation. |
   | Renew | `domainRenew` | Billable; body `cost`; disable if cost cannot be re-verified. |
   | Transfer | `listTransfersGet`, `getTransferGet`, `transferDomain` | Auth code is sensitive and short-lived in form state only. |
   | Account | `getBalance`, `getApiSettings` | Independent loading/error states. |
   | Marketplace P2 | `listMarketplaceListingsGet` | Read-only browser. |
   | Email P2 | `emailSetPassword` | Sensitive password form; later phase. |
   | Account invite P2 | `createAccountInvite`, `getAccountInviteStatus` | Later phase. |

4. [ ] Complete the Ink framework spike before production implementation.
   1. [ ] Add a temporary isolated spike under `src/tui/spike/` or `test/fixtures/` and remove or quarantine it before release.
   2. [ ] Install candidate runtime dependencies: `ink`, `react`, and only the minimal helper packages actually needed for terminal control/testing. Install corresponding TypeScript/test dev dependencies, update `package-lock.json`, and perform a dependency review per PRD section 15 covering license, maintenance, transitive dependencies, terminal-input handling, and ANSI-rendering risks.
   3. [ ] Update `tsconfig.json` for `.tsx` and JSX, e.g. include `src/**/*.tsx` and configure JSX for React with NodeNext ESM compatibility.
   4. [ ] Prove the first frame renders before network calls and within the PRD target after local startup work.
   5. [ ] Prove keyboard navigation over 10,000 in-memory domain rows renders within 50 ms per input event by rendering only visible rows plus small overscan; never render more than 100 rows unless measured equivalent performance is documented.
   6. [ ] Prove search feedback appears within 200 ms with a 150 ms maximum debounce.
   7. [ ] Prove alternate-screen enter/exit, cursor restoration, Ctrl+C cleanup, handled-error cleanup, and rejected-startup cleanup.
   8. [ ] Prove terminal resize handling does not crash and does not lose form state.
   9. [ ] Prove deterministic component/input tests are possible with the selected test approach.
   10. [ ] Measure install size and startup impact; document results in the final implementation PR or a short `docs/TUI-spike-notes.md` if useful.
   11. [ ] If Ink fails any gate, stop production implementation and revisit framework choice while keeping the PRD requirements unchanged.

5. [ ] Create the TUI module skeleton.
   1. [ ] Add `src/tui/index.tsx` for TTY checks, terminal lifecycle, Ink render/unmount, and exported `launchTui(options)`.
   2. [ ] Add `src/tui/app.tsx` as the root React component that receives injected services, runtime options, terminal capabilities, and initial route.
   3. [ ] Add `src/tui/routes.ts` for typed route/navigation state: startup, domains list, domain detail tab, transfers, register, account, help, command palette, modal/form/review/result overlays.
   4. [ ] Add `src/tui/keymap.ts` for all global and contextual keys from PRD section 10.
   5. [ ] Add `src/tui/theme.ts` for color/no-color/icon choices and semantic labels for read-only, mutating, destructive, billable, web-only, stale, error, and selected states.
   6. [ ] Add `src/tui/redact.ts` for UI redaction and safe rendering of untrusted strings.
   7. [ ] Add `src/tui/types.ts` for normalized domain, DNS, nameserver, glue, forward, DNSSEC, transfer, account, SSL metadata, request, form, selection, cache, and operation-result types.
   8. [ ] Add `src/tui/services/` for API-facing services; services must depend on `ApiClient` and `OperationDefinition`, not Commander.
   9. [ ] Add `src/tui/state/` for reducers/controllers and pure state transitions.
   10. [ ] Add `src/tui/forms/` for validation, normalization, review snapshot creation, confirmation-level assignment, and request payload building.
   11. [ ] Add `src/tui/components/` for reusable layout, list, table, form, modal, help, review, result, and status primitives.
   12. [ ] Add `src/tui/screens/` for startup/auth, portfolio, domain detail tabs, transfers, register, account, help, and bulk screens.

6. [ ] Extend shared infrastructure safely for TUI needs.
   1. [ ] Add optional `AbortSignal` support to `ApiClient.request` for cancelable reads. Compose it with the existing timeout signal without changing default timeouts or error kinds.
   2. [ ] Do not allow TUI cancellation to abandon a mutation after the request is sent. For mutations, disable submit while in flight and present an “unknown result; refresh resource” warning if the user exits before reconciliation.
   3. [ ] Add a shared, non-secret request-preview helper if needed so TUI review screens can display normalized request data and idempotency keys without performing `dryRun` calls or duplicating credential injection. The helper must derive the idempotency key from the exact body that will be submitted so the key shown at review equals the key sent; when price re-verification changes `cost`, the body and therefore the key legitimately change (a distinct request), and this must not be "corrected" to keep keys equal.
   4. [ ] Reuse `deterministicIdempotencyKey` for mutating TUI requests unless the user explicitly requests a fresh key in a future feature; do not add fresh keys by default.
   5. [ ] Keep `validateBaseUrl` credential-origin restrictions intact. For tests, prefer dependency injection/MockAgent/test harnesses; do not add a production bypass that sends credentials to arbitrary origins.
   6. [ ] Add exported helpers only when they are useful to both CLI and TUI, and keep existing exports backward-compatible.
   7. [ ] Decide where `--verbose` request logging goes in TUI mode: `ApiClient` verbose output must never be written to stdout/stderr while Ink owns the alternate screen, because it corrupts rendering. Route it to an in-app debug view or buffer it and flush to stderr only after alternate-screen exit; do not persist it to disk. Named non-TUI commands keep their existing verbose behavior unchanged.

7. [ ] Implement TUI service normalization.
   1. [ ] Create `TuiApiService` with methods for every API-backed workflow in the operation map.
   2. [ ] Inject `ApiClient` or a narrow request function so unit/component tests can use deterministic fake services.
   3. [ ] Normalize domain list rows to include at least `domain`, `status`, `tld`, `createDate`, `expireDate`, `securityLock`, `whoisPrivacy`, `autoRenew`, `apiAccess`, `notLocal`, and read-only `labels` when present.
   4. [ ] Normalize `autoRenew`, `apiAccess`, `securityLock`, `whoisPrivacy`, and `notLocal` from API integer/string values to booleans plus original raw values.
   5. [ ] Normalize DNS records with `id`, `name`, `type`, `content`, `ttl`, `prio`, and `notes` while preserving raw record data for safe detail display.
   6. [ ] Normalize glue `hosts` tuple responses into `{hostname, subdomain, ipv4[], ipv6[], ips[]}` and tolerate malformed entries by showing a tab-scoped parse warning instead of crashing.
   7. [ ] Normalize DNSSEC object responses into sorted arrays keyed by `keyTag`.
   8. [ ] Normalize account balance and API settings into cents, display strings, and raw settings fields.
   9. [ ] Normalize domain-check pricing into exact integer cents using string parsing; never use binary floating point for money conversion.
   10. [ ] Return `ResourceState<T>` values with `idle | loading | loaded | stale | error` metadata, timestamps, request IDs, retryability, and stale markers.

8. [ ] Implement redaction, sanitization, and safe rendering utilities.
   1. [ ] Strip or replace terminal control characters from all API-provided strings before rendering; allow only explicitly handled line breaks and tabs.
   2. [ ] Bound rendered field lengths in tables/lists and provide a safe detail viewer for long values.
   3. [ ] Treat keys matching API keys, secret keys, passwords, auth codes, request tokens, authorization, private keys, and SSL bundle material as sensitive.
   4. [ ] Add `redactReviewValue` and `redactErrorValue` helpers used by all review screens, status lines, and error views.
   5. [ ] Add tests proving control characters, ANSI escapes, private keys, transfer auth codes, passwords, API keys, and secret keys never appear in snapshots or error renderings.

9. [ ] Build the core state model.
   1. [ ] Implement session state: credential source/profile, base URL/IP mode, timeout, verbose/no-color, terminal capabilities, ping status, account summary states.
   2. [ ] Implement navigation state: current route, selected domain, active tab, back stack, modal stack, command palette state, and focused region.
   3. [ ] Implement portfolio query state: server filters, client-only filters, search text, debounced search, sort, loaded pages, loaded completeness, scroll position, selected row.
   4. [ ] Implement resource cache state keyed by resource type and domain, with fetched/stale/error metadata and 30-second default freshness.
   5. [ ] Implement form state as local/short-lived state with values, field errors, warnings, touched fields, review snapshot, and sensitive field cleanup callbacks.
   6. [ ] Implement operation state: confirmation level, idempotency key, in-flight flag, request ID, result state, reconciliation/invalidation targets.
   7. [ ] Implement selection state: explicit selected domain names, visible-page selection, optional all-current-filter descriptor only when the loaded result set is complete and safe.
   8. [ ] Keep private keys, API secrets, transfer auth codes, and email passwords out of global state; store sensitive form values only in the active form component/controller and clear on submit/cancel/unmount.

10. [ ] Build generic UI primitives.
   1. [ ] Implement `AppFrame` with header, navigation, main content, footer, modal layer, and minimum-size guard.
   2. [ ] Implement breakpoints exactly as PRD section 9.2: wide `>=120`, medium `80-119`, compact `60-79`, minimum-size message below `60` columns or `18` rows.
   3. [ ] Implement alternate-screen lifecycle in `launchTui`: enter only after TTY validation succeeds, restore on normal exit, Ctrl+C, thrown errors, and rejected startup.
   4. [ ] Implement visible focus markers using both color and non-color text/symbol markers.
   5. [ ] Implement no-color and plain-symbol modes; meaning must never depend on color alone.
   6. [ ] Implement `VirtualList` for domain and marketplace-scale lists with bounded rendering, scroll preservation, selected-row visibility, and resize-aware viewport height.
   7. [ ] Implement safe `DataTable`, `KeyHelp`, `StatusLine`, `LoadingState`, `EmptyState`, `ErrorState`, `StaleBanner`, `ConfirmModal`, `ReviewScreen`, `ResultScreen`, `CommandPalette`, and `ContextHelp` primitives.
   8. [ ] Implement a simple focus manager for `Tab`, `Shift+Tab`, arrow keys, forms, lists, and modals.
   9. [ ] Implement global key handling: `?`, `/`, `Esc`, `q`, `Ctrl+C`, `r`, `Tab`, `Shift+Tab`, arrows, optional `j/k`, `Enter`, `Space`, `:`.
   10. [ ] Ensure keys that can mutate remote state always route to review/confirmation; a single keypress must never change remote state.
   11. [ ] Implement `Ctrl+C` as the two-stage behavior in PRD section 10.1: if a cancelable request is in flight, cancel it; otherwise request exit. Cancellation applies to reads only — never abandon a mutation after it is sent (see 6.2/18.12). Terminal restoration on `Ctrl+C` still applies in both stages (10.3, 33.7).

11. [ ] Integrate the TUI into the CLI.
   1. [ ] Add a root Commander action for no subcommand.
   2. [ ] If no subcommand and both stdin/stdout are TTYs, launch the TUI.
   3. [ ] If no subcommand and stdin or stdout is not a TTY, print concise command help, do not read stdin, do not emit terminal control sequences, and exit successfully.
   4. [ ] Register `porkbun tui` as an explicit command outside the generated operation hierarchy.
   5. [ ] For explicit `porkbun tui` in a non-TTY context, throw a `CliError` with `kind: "usage"` and a clear message; preserve JSON error-envelope behavior in non-interactive stderr.
   6. [ ] Preserve `porkbun --help`, `porkbun --version`, and every named subcommand.
   7. [ ] Accept TUI-relevant global options: `--profile`, `--api-key`, `--secret-api-key`, `--base-url`, `--ipv4`, `--timeout`, `--verbose`, and `--no-color`.
   8. [ ] Reject TUI-irrelevant global options when explicitly supplied with bare interactive `porkbun` or `porkbun tui`: `--output`, `--fields`, `--limit`, `--offset`, `--dry-run`, `--yes`, `--idempotency-key`, and `--fresh-idempotency-key`. Use Commander option value sources so default values do not falsely reject.
   9. [ ] Update root help to say bare interactive invocation launches the TUI.
   10. [ ] Add `porkbun tui --help` text documenting TTY requirements, supported global options, and a short key summary.
   11. [ ] Update `src/lib/schema.ts` static command metadata to include `tui` as an interactive command if the schema should enumerate all top-level commands; do not imply it is automation-friendly structured output.

12. [ ] Implement startup, authentication, and profile selection.
   1. [ ] Determine credential source before constructing the main authenticated service: flags first, environment second, saved profile third.
   2. [ ] If either credential flag is supplied without the other, show/throw the existing auth error; never prompt for secret keys in the TUI.
   3. [ ] If environment credentials are selected, identify them as environment-sourced in the UI but never display values.
   4. [ ] If `--profile <name>` is supplied, select that profile directly and show profile-sourced metadata only.
   5. [ ] If multiple saved profiles exist and no higher-precedence credential source is selected, show a startup profile picker even if an active profile exists.
   6. [ ] If one saved profile exists and no higher-precedence source exists, use it directly.
   7. [ ] If no credentials are available, show an auth error screen offering retry, profile change if profiles exist, and exit; instruct users to run `porkbun auth login` rather than collecting keys in the TUI.
   8. [ ] Validate selected credentials with `pingGet` at startup. Because `pingGet`/`ping` is optional-auth, a 2xx response alone does not prove the credentials are valid; the startup gate must assert the response `credentialsValid` field is true (and treat its absence/false as an authentication failure) rather than accepting any successful HTTP status.
   9. [ ] Load account balance and API settings independently from ping/domain loading; failure of account summary calls must not block domain browsing.
   10. [ ] Authentication failures must offer retry, profile change, and exit.
   11. [ ] Header must show product name, active credential source/profile, connection state, account balance when loaded, and current context.

13. [ ] Implement portfolio data loading.
   1. [ ] Use `getDomains` with `includeLabels=yes` by default so existing labels can be displayed and filtered read-only.
   2. [ ] Use API-side filters/sorts when supported: exact domain, name substring, expiring-within-days, TLDs, auto-renew, API access, domain/TLD/expiration sorting.
   3. [ ] Track API page chunks using `start`. Because the API returns up to 1000 rows and no guaranteed total, mark the result set complete only when a page returns fewer than 1000 rows or an exact-domain query proves completeness.
   4. [ ] Keep the UI page/window size bounded to the viewport/default 100 rows even if an API chunk returns 1000 rows.
   5. [ ] Support explicit next, previous, and load-more actions; never issue one request per domain to render the list.
   6. [ ] Preserve selected domain, active filters, sort, scroll position, and page offset on refresh when the item still exists.
   7. [ ] Deduplicate concurrent loads for the same query/page key and cancel/supersede stale read requests when navigation/query changes.
   8. [ ] Display clear loading, empty, no-filter-matches, stale, and error states.
   9. [ ] Show a visible incomplete-results banner whenever client-only filtering or sorting is applied to an incomplete loaded set.
   10. [ ] Apply the 30-second default freshness window (PRD section 14.4) to the loaded domain list itself, marking it stale and surfacing a stale marker plus manual refresh once elapsed, consistent with the detail-tab freshness handling.

14. [ ] Implement portfolio search, filters, sort, and selection.
   1. [ ] Search must support case-insensitive domain substring matching with a 150 ms maximum debounce.
   2. [ ] Prefer API `nameContains` for domain search; if client-side refinement is additionally used, clearly label the scope.
   3. [ ] Add filters for TLD, expiration window, auto-renew, API access, status, and read-only labels.
   4. [ ] Implement expiration windows for expired, within 7, 30, and 90 days; use API `expiringWithinDays` where possible and client refinement for expired/status/labels.
   5. [ ] Add sort by domain, expiration, TLD, auto-renew, and API access in ascending/descending order. Use API sort for domain/TLD/expiration; use client sort for auto-renew/API access with incomplete-set warning unless all matching rows are loaded.
   6. [ ] Render domain, status, expiration ISO date plus relative time, auto-renew, API access, TLD, labels, and attention indicator when returned.
   7. [ ] Implement attention indicators for expired/inactive/error status, expiration within 7/30/90 days, auto-renew disabled, API access disabled, and active/pending transfer when known.
   8. [ ] Implement individual row selection with `Space`.
   9. [ ] Implement visible-page selection.
   10. [ ] Enable all-current-filter selection only when completeness is known; otherwise show a disabled reason.
   11. [ ] Footer/status must state exactly how many domains are selected and whether selection extends beyond loaded rows.

15. [ ] Implement domain detail shell and lazy tab cache.
   1. [ ] Opening a domain fetches `getDomain` with labels and displays all returned fields in the Overview tab without raw credentials.
   2. [ ] Detail tabs are `Overview`, `DNS`, `Nameservers`, `Glue`, `Forwards`, `DNSSEC`, `SSL`, and `Transfer`.
   3. [ ] Load each tab lazily on first visit, cache for the session, mark stale after the freshness window, and provide explicit refresh.
   4. [ ] A failure in one tab must be isolated to that tab and must not discard already loaded data in other tabs.
   5. [ ] Show tab-level loading/error/empty/stale states.
   6. [ ] Overview must include a non-blocking “Web-only capabilities” section listing unsupported domain contacts, registrar lock/unlock, transfer-out auth, WHOIS privacy mode, labels editing, external domains, API access toggles, managed DNSSEC toggle, parking, pushes, hosting lifecycle, marketplace settings, deletion, checkout/payment/account settings, and other PRD-listed web-only features.

16. [ ] Implement read-only DNS tab behavior.
   1. [ ] List DNS records with type, name, content, TTL, priority, notes, and ID.
   2. [ ] Add DNS record filters by type, name, or content.
   3. [ ] Bound long record content and offer a safe detail view.
   4. [ ] Show Cloudflare/proxy metadata if returned without treating it as editable unless the public API exposes mutation support.

17. [ ] Implement read-only Nameservers, Glue, Forwards, DNSSEC, SSL, Transfer, and Account views.
   1. [ ] Nameservers tab shows ordered authoritative nameservers.
   2. [ ] Glue tab lists hostnames and IPv4/IPv6 addresses.
   3. [ ] Forwards tab lists ID, subdomain, target location, redirect type, include-path, and wildcard when returned.
   4. [ ] DNSSEC tab lists registry DNSSEC records and explicitly distinguishes them from Porkbun’s web-only DNSSEC convenience toggle.
   5. [ ] SSL tab initially shows an explicit “Fetch SSL bundle” action and security warning; do not prefetch.
   6. [ ] Transfer tab shows per-domain transfer status and marks transfer-out workflows web-only.
   7. [ ] Account screen shows account credit balance and API spend settings with independent loading/error states and no payment instruments/passwords/API keys/secret keys.

18. [ ] Build the shared mutation framework.
   1. [ ] Implement the state machine `edit -> validate -> review -> confirm -> submit -> reconcile -> result` as reusable controller logic.
   2. [ ] Forms must never submit directly from an editable field.
   3. [ ] Review screens must show normalized request data with secrets redacted, target domain/resource, labels for read-only/mutating/destructive/billable, idempotency key where useful, and expected cache invalidations.
   4. [ ] Standard mutations require review plus confirm key.
   5. [ ] Disruptive/destructive mutations require explicit confirmation text or equivalent danger confirmation.
   6. [ ] Bulk disruptive mutations require typing selected count.
   7. [ ] Billable mutations require typing the exact domain and completing the pricing re-verification flow.
   8. [ ] The user can return from review to edit without losing non-sensitive input.
   9. [ ] Submit is disabled while a request is in flight.
   10. [ ] Request IDs from API failures are shown for support correlation.
   11. [ ] After success, invalidate affected resource cache keys and refresh visible resources while keeping focus near the affected item.
   12. [ ] If the user exits while a mutation is in flight, do not report success; show an unknown-result warning and advise targeted refresh on restart.

19. [ ] Implement DNS record mutations.
   1. [ ] Create and edit forms support `type`, `name`, `content`, `ttl`, `prio`, and `notes`.
   2. [ ] Validate required `type` and `content`.
   3. [ ] Validate TTL and priority as numeric integers where present.
   4. [ ] Validate IPv4 content for `A` and IPv6 content for `AAAA` using deterministic validators.
   5. [ ] Warn but do not over-reject complex `TXT`, `CAA`, and `SRV` values.
   6. [ ] Default edit/delete to record ID using `dnsEdit` and `dnsDelete`.
   7. [ ] Offer name/type bulk edit/delete only behind review screens that clearly state multiple records can be affected.
   8. [ ] Delete confirmation displays the complete record and domain.
   9. [ ] After mutation success, refresh records and keep focus near the affected record/new record.

20. [ ] Implement nameserver update.
   1. [ ] Update form supports adding, removing, reordering, and editing nameserver hostnames.
   2. [ ] Validate hostname syntax and reject empty entries.
   3. [ ] Prohibit empty nameserver submission unless a future documented reset-to-default operation is added.
   4. [ ] Review shows old-versus-new diff.
   5. [ ] Review warns that nameserver changes can disconnect Porkbun-managed DNS records and related services.
   6. [ ] Submit with `domainUpdateNs`, then refresh nameservers and domain detail.

21. [ ] Implement auto-renew mutations.
   1. [ ] Support toggling auto-renew for one domain from detail/list context.
   2. [ ] Support toggling auto-renew for multiple selected domains.
   3. [ ] Review shows previous and requested state for each domain.
   4. [ ] Use `domainUpdateAutoRenew`, mapping UI state to `status: on|off`.
   5. [ ] Preserve per-domain result states from API `results` when provided; otherwise synthesize clear success/failure states from the response.
   6. [ ] Refresh domain portfolio rows and selected domain detail on success.

22. [ ] Implement glue record mutations.
   1. [ ] Create/update forms accept subdomain/hostname and one or more IPv4/IPv6 addresses.
   2. [ ] Validate the hostname belongs to the selected parent domain; normalize FQDN input to the subdomain path parameter where useful.
   3. [ ] Validate every address with `net.isIP` or equivalent.
   4. [ ] Delete review shows hostname and all known addresses.
   5. [ ] Submit via `domainCreateGlue`, `domainUpdateGlue`, or `domainDeleteGlue`, then refresh glue records and nameserver-related detail if relevant.

23. [ ] Implement URL forwarding mutations.
   1. [ ] Add form supports subdomain, target URL, `permanent|temporary`, include-path `yes|no`, and wildcard `yes|no`.
   2. [ ] Validate target URLs use `http` or `https`.
   3. [ ] Validate subdomain according to API constraints and allow blank/root where supported.
   4. [ ] Explain in the form and tab help that the API does not expose forward editing; replacement is delete then add.
   5. [ ] Delete review shows ID, subdomain, target, type, include-path, wildcard, and domain.
   6. [ ] Refresh forwards after add/delete.

24. [ ] Implement registry DNSSEC mutations.
   1. [ ] Create form supports required DS fields `keyTag`, `alg`, `digestType`, and `digest`.
   2. [ ] Create form supports advanced optional key-data fields `maxSigLife`, `keyDataFlags`, `keyDataProtocol`, `keyDataAlgo`, and `keyDataPubKey`.
   3. [ ] Validate required fields, integer-like fields, digest non-empty/hex-looking values where deterministic, and keep advanced validation conservative.
   4. [ ] Delete requires explicit confirmation of domain and key tag.
   5. [ ] Review copy must distinguish registry DNSSEC records from web-only Porkbun DNSSEC toggle.
   6. [ ] Refresh DNSSEC records after create/delete.

25. [ ] Implement availability check, registration, and manual renewal.
   1. [ ] Register screen accepts one fully qualified domain name per availability check in v1.
   2. [ ] Availability result shows availability, registration price, renewal price when available, premium/special status, minimum duration, rate-limit info, and account balance.
   3. [ ] Registration review shows exact domain, expected cost in USD and API pennies, terms acknowledgement, billable/irreversible warning, and current account balance.
   4. [ ] Registration final submit requires typing the exact domain or equally strong confirmation before sending `agreeToTerms`.
   5. [ ] Manual renewal flow starts from a selected domain and retrieves current renewal pricing from `domainCheckDomain.response.additional.renewal.price` where available.
   6. [ ] Manual renewal review shows exact domain, expected charge in USD, charge in API pennies, current balance, and billable warning.
   7. [ ] If pricing cannot be established reliably, disable submit and explain why.
   8. [ ] For registration and renewal, re-verify price immediately before submission and display `price verified at <ISO timestamp>`.
   9. [ ] If re-verified price differs from the review-entry price, notify the user, update the review snapshot, and require re-confirmation before enabling submit.
   10. [ ] Submit registration via `domainCreate` and renewal via `domainRenew` with exact cents.
   11. [ ] After successful registration/renewal, refresh account balance and portfolio; for renewal also refresh expiration/detail.

26. [ ] Implement inbound transfers.
   1. [ ] Transfers screen lists active inbound transfers with domain, status, description, transfer date, and order ID when returned.
   2. [ ] Transfer initiation form accepts domain and authorization code.
   3. [ ] Mask authorization code by default, never include it in logs/errors/review cleartext, and clear it after submission, cancellation, or unmount.
   4. [ ] Retrieve expected transfer cost from `domainCheckDomain.response.additional.transfer.price` where available; disable submit if unavailable.
   5. [ ] Re-verify transfer price immediately before submission and display `price verified at <ISO timestamp>`.
   6. [ ] If re-verified transfer price differs, require re-confirmation.
   7. [ ] Submit via `transferDomain` with exact cents and auth code.
   8. [ ] Provide transfer detail/status refresh using `getTransferGet`.
   9. [ ] Mark transfer-out workflows as web-only with official handoff text.

27. [ ] Implement SSL bundle secure export.
   1. [ ] SSL tab fetches data only after explicit user action.
   2. [ ] Never render private key, full certificate chain, or public key contents in normal viewport, status line, errors, debug logs, or snapshots.
   3. [ ] Export form requires or clearly asks for a user-selected directory; prefer explicit path over implicit default.
   4. [ ] Use predictable filenames such as `<domain>.certificate-chain.pem`, `<domain>.public-key.pem`, and `<domain>.private-key.pem`.
   5. [ ] Create export directory with mode `0700` when created; chmod existing newly-created directory defensively.
   6. [ ] Write private key mode `0600`; certificate/public files mode no broader than `0644`.
   7. [ ] Refuse silent overwrite. If any target exists, show all existing paths and require explicit overwrite confirmation.
   8. [ ] On success, show file paths and safe certificate metadata only, such as parsed subject/issuer/notBefore/notAfter/fingerprint if available, file sizes, and write modes.
   9. [ ] Clear SSL bundle material from component/service memory as soon as export completes or is cancelled where practical.

28. [ ] Implement supported bulk operations.
   1. [ ] Limit v1 bulk actions to auto-renew change, nameserver replacement, adding a DNS record, adding a URL forward, and manual refresh/export of a result summary.
   2. [ ] Before execution show selected domain count and scope, exact intended operation, destructive/replacement warning, estimated API call count, and unavailable domains with reasons. Note: no v1 bulk action in 28.1 is billable and bulk billing is out of scope per PRD section 12, so a billable-total line is defensive/not-applicable for the v1 bulk set; do not build a bulk billing flow.
   3. [ ] Default bounded concurrency to 3 and allow configuration up to maximum 10 only inside the UI.
   4. [ ] Every domain has independent state: pending, running, succeeded, failed, skipped, or cancelled.
   5. [ ] Failure must not roll back unrelated successes or silently retry non-idempotent requests.
   6. [ ] Use deterministic idempotency keys for each mutating request.
   7. [ ] Allow retry of failed items only while preserving the originally reviewed payload unless the user returns to edit.
   8. [ ] Bulk DNS, nameserver, and forwarding warnings explicitly state that changes can disrupt all selected domains.
   9. [ ] Native API bulk auto-renew may be used if it preserves per-domain results; otherwise execute per-domain with the scheduler.
   10. [ ] Result summary export must redact secrets and include operation, timestamp, selected scope, per-domain status, request IDs, and errors.

29. [ ] Implement command palette and contextual help.
   1. [ ] `:` opens a searchable command palette filtered by current context.
   2. [ ] Every action displays name, affected resource, classification (`read-only`, `mutating`, `destructive`, `billable`, `web-only`), and disabled reason when unavailable.
   3. [ ] `?` opens contextual help listing current keys, action descriptions, safety implications, and relevant API limitations.
   4. [ ] Unsupported web features must state exactly “Not available in Porkbun API v3”.
   5. [ ] Include copyable HTTPS handoff URLs from PRD section 24 where relevant.
   6. [ ] Do not automatically open a browser unless a future distinct user action is added; for this PRD, showing/copying URLs is sufficient.

30. [ ] Implement error, loading, cancellation, and stale behavior consistently.
   1. [ ] Map `CliError` kinds to TUI presentations for authentication, authorization/API access disabled, validation/usage, network, timeout, rate limit, Porkbun API/business rule, not-found/conflict, and unexpected internal errors.
   2. [ ] Loading indicators identify the resource being loaded.
   3. [ ] Read requests can be cancelled or superseded when navigation changes.
   4. [ ] Mutating requests are reconciled when possible after being sent.
   5. [ ] Rate-limit errors display reset/retry information from `ttlRemaining` or `X-RateLimit-Reset` details when present.
   6. [ ] Retry controls are available for retryable reads.
   7. [ ] Stale cached content may remain visible with a clear stale/error marker.
   8. [ ] Empty states distinguish no resources, no filter matches, and not available through API.
   9. [ ] No offline mutation queue is implemented.

31. [ ] Implement P2/later API surfaces after P0/P1 are stable.
   1. [ ] Marketplace browser uses `listMarketplaceListingsGet` read-only with query, TLD, SLD length, sort, pagination, loading/error/empty states, and no listing mutation claims.
   2. [ ] Email hosting password update uses `emailSetPassword` with masked password form, no logs/snapshots, mutation review, and password cleanup.
   3. [ ] Account invite workflow uses `createAccountInvite` and `getAccountInviteStatus`, treats invite tokens/URLs as sensitive enough for redaction where appropriate, and documents the web handoff.
   4. [ ] Keep these features clearly separated from v1 release acceptance if project scope chooses to ship P0/P1 first.

32. [ ] Polish accessibility and usability.
   1. [ ] All actions are keyboard-accessible; mouse support remains optional and non-required.
   2. [ ] Focus is always visible with color plus a non-color marker.
   3. [ ] Status uses text/symbols and not color alone.
   4. [ ] `--no-color` and `NO_COLOR`-style environments provide equivalent information.
   5. [ ] Unicode symbols have plain-text fallbacks when terminal capability is uncertain or icons are disabled.
   6. [ ] Forms provide field-level errors and submit summaries.
   7. [ ] Help text uses consistent verbs and key names.
   8. [ ] Dates include unambiguous ISO dates; relative dates are supplemental.
   9. [ ] Monetary values display USD and API pennies/cents.
   10. [ ] Destructive, billable, and web-only labels use consistent wording.
   11. [ ] Resolve PRD section 23 Q7: decide whether a screen-reader-friendly terminal mode is practical for v1 or whether the existing non-interactive CLI is the documented supported accessible alternative. Default to documenting the non-interactive CLI as the accessible fallback unless the spike shows a practical screen-reader mode; record the decision and reflect it in the docs (step 38).

33. [ ] Meet performance and reliability targets.
   1. [ ] First frame appears within 300 ms after local startup work, excluding network calls.
   2. [ ] Startup remains usable while ping/account/domain requests load.
   3. [ ] 10,000 loaded domains navigate within 50 ms per input event.
   4. [ ] Search feedback appears within 200 ms.
   5. [ ] No more than 100 domain rows render simultaneously unless spike measurements justify otherwise.
   6. [ ] Default bulk concurrency is 3.
   7. [ ] Terminal cursor, input mode, and alternate screen restore after normal exit, Ctrl+C, handled errors, and rejected startup.
   8. [ ] Resize events never crash the process or lose form values.

34. [ ] Add unit tests for pure logic.
   1. [ ] Reducers and navigation transitions.
   2. [ ] Portfolio filters, sorting, pagination, completeness, and selection.
   3. [ ] Attention indicators and date thresholds.
   4. [ ] Form validation and request normalization for DNS, nameservers, glue, forwarding, DNSSEC, auto-renew, registration, renewal, transfer, SSL export, and bulk actions.
   5. [ ] Price string to cents conversion and cents/USD formatting.
   6. [ ] Redaction and control-character sanitization.
   7. [ ] Confirmation-level assignment and mutation state machine transitions.
   8. [ ] Cache invalidation and stale metadata.
   9. [ ] Bulk scheduler concurrency, cancellation, partial failure, and failed-only retry.
   10. [ ] Credential/profile selection precedence including multiple-profile picker condition.

35. [ ] Add component tests.
   1. [ ] Render every loading, empty, populated, stale, error, review, confirmation, result, and minimum-size state.
   2. [ ] Test keyboard navigation, focus, Tab/Shift+Tab, list movement, modal close, form cancellation, and command palette filtering.
   3. [ ] Test no-color and compact layouts.
   4. [ ] Test prevention of direct mutation from edit state.
   5. [ ] Test secret masking and absence of secrets/private key material from rendered snapshots.
   6. [ ] Test profile picker, auth error retry/profile change/exit, and account summary optional failures.

36. [ ] Add integration tests against mocked API services.
   1. [ ] Use injected fake service or `undici` MockAgent in-process for most TUI integration tests so credential-origin restrictions remain intact. This is how PRD section 18.3's "local HTTP server" intent is satisfied for credentialed flows: `validateBaseUrl` refuses to send credentials to any non-Porkbun origin, so credentialed reads/mutations must be tested with MockAgent intercepting the official origin (as `test/api-client.test.mjs` does), reserving a real loopback `http.createServer` (as `test/cli-contract.test.mjs` does) for non-credentialed or `dryRun` paths only.
   2. [ ] Verify startup and credential validation.
   3. [ ] Verify portfolio loading, server query construction, pagination, completeness banners, and refresh preservation.
   4. [ ] Verify domain-to-detail navigation and lazy tab loading.
   5. [ ] Verify DNS CRUD, nameserver update, auto-renew, glue, forwarding, DNSSEC, registration, renewal, transfer, and SSL export requests and post-mutation invalidation.
   6. [ ] Verify mutation confirmation and deterministic idempotency headers.
   7. [ ] Verify rate limits, timeouts, malformed data, API errors, request IDs, and retry controls.
   8. [ ] Verify SSL export permissions and overwrite refusal on the real filesystem using temporary directories.
   9. [ ] Do not add a production-only bypass that sends credentials to non-Porkbun origins just to make tests easier.

37. [ ] Add pseudo-terminal/end-to-end tests.
   1. [ ] Run built `dist/cli.js` under a pseudo-terminal for TTY detection, bare `porkbun` startup, explicit `porkbun tui`, `Ctrl+C`, `q`, resize behavior, minimum-size behavior, and alternate-screen cleanup.
   2. [ ] Run non-TTY `porkbun` with no subcommand and assert concise help, exit code 0, no stdin read, and no terminal control sequences.
   3. [ ] Run non-TTY `porkbun tui` and assert structured usage error.
   4. [ ] Use a PTY TUI test harness with injected fake services for full representative workflows if the built CLI cannot safely use a local authenticated API server without weakening credential-origin policy.
   5. [ ] Capture terminal output and assert no API keys, secret keys, auth codes, passwords, private keys, or full certificate material appear.

38. [ ] Update documentation.
   1. [ ] Update `README.md` with TUI launch behavior, `porkbun tui`, TTY/non-TTY behavior, supported global options, and quick navigation keys.
   2. [ ] Add or update docs for credentials/profile selection, mutation safety, billable operations, SSL export, bulk operations, API limitations/web-only handoffs, troubleshooting, no-telemetry/no-persistence guarantees, and the accessible-mode guidance decided in 32.11.
   3. [ ] Document that users should run `porkbun auth login` for saved credentials; the TUI does not collect secret keys in MVP.
   4. [ ] Document exact unsupported web features and official Porkbun URLs from the PRD.
   5. [ ] Update `CHANGELOG.md` when implementation is complete.
   6. [ ] If package publication should include docs, update `package.json` `files` deliberately; otherwise ensure README links do not point to unpublished-only docs for npm users.

39. [ ] Keep existing CLI behavior green throughout.
   1. [ ] Existing `npm test` must pass after every major phase.
   2. [ ] Existing operation registry coverage must still cover every bundled OpenAPI operation ID.
   3. [ ] Existing structured output, `--fields`, `--limit`, `--offset`, `--dry-run`, `--yes`, auth profile, redaction, and base URL tests must not regress.
   4. [ ] Named commands must not incur TUI startup cost or require TUI dependencies at command execution time beyond normal module loading needed by the package.

40. [ ] Verify P0 release gate.
   1. [ ] Bare interactive `porkbun` launches TUI and `porkbun tui` works.
   2. [ ] Non-TTY behavior satisfies `TUI-AUTH-007`.
   3. [ ] Credential/profile selection and ping validation work.
   4. [ ] Domain list, search, filters, sort, pagination, refresh, responsive layouts, and attention indicators work.
   5. [ ] Domain overview, read-only DNS, nameservers, balance/settings, help, errors, and loading states work.
   6. [ ] DNS CRUD, nameserver update, auto-renew, shared mutation safety, and post-mutation refresh work.
   7. [ ] Unit/component/integration/PTY tests for P0 pass.

41. [ ] Verify P1/v1 release gate.
   1. [ ] Glue, forwards, registry DNSSEC, availability, registration, renewal, inbound transfers/status, SSL secure export, and supported bulk actions work.
   2. [ ] Billable operations re-verify price immediately before submit and require re-confirmation if price changes.
   3. [ ] Bulk operations produce explicit per-domain results and partial failures.
   4. [ ] Web-only features are accurately identified as unsupported by API v3.
   5. [ ] Existing CLI commands and structured output contracts have no regressions.
   6. [ ] `npm test` passes on the minimum supported Node.js version.
   7. [ ] Security review finds no secret rendering, unsafe export permissions, terminal injection, credential-origin regression, or telemetry/persistence violation.
   8. [ ] User documentation covers launch, navigation, credentials, safety, API limitations, and troubleshooting.

42. [ ] Verify full PRD completion including P2/later items if the project elects to implement beyond v1 in this branch.
   1. [ ] Marketplace browser is complete and read-only.
   2. [ ] Email hosting password update is complete with secret-safe handling.
   3. [ ] Account invite workflow is complete.
   4. [ ] Web-only handoffs are complete with official HTTPS URLs.
   5. [ ] Manual validation matrix is executed: macOS Terminal, iTerm2, Linux terminal such as GNOME Terminal, tmux, SSH session, 80x24 and wide layouts, light/dark themes, color/no-color, slow/failed/rate-limited responses.
