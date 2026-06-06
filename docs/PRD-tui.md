# Product Requirements Document: Porkbun Terminal User Interface

**Status:** Draft  
**Owner:** Jose Mocito  
**Branch:** `feature/tui`  
**Target package:** `porkbun-cli`  
**Last updated:** 2026-06-06

## 1. Summary

Add an interactive terminal user interface (TUI) to `porkbun-cli` that lets a
human browse a Porkbun account's domain portfolio and perform the domain
management tasks exposed by Porkbun API v3.

The TUI should reproduce the useful workflows and information architecture of
Porkbun's web Domain Management interface where the public API permits it. It
must not scrape the website, depend on a browser session, or imply support for
web-only operations. Unsupported web features should be identified clearly and,
where useful, accompanied by a Porkbun web or knowledge-base handoff.

The TUI will be launched with:

```sh
porkbun tui
```

It will reuse the existing credential resolution, API client, operation
definitions, validation, error mapping, idempotency, and mutation safety
behavior. The existing non-interactive CLI contract remains unchanged.

## 2. Background

`porkbun-cli` currently provides structured commands for all operation IDs in
the bundled Porkbun OpenAPI specification. Its primary interface is optimized
for agents and shell automation. Human users can perform the same operations,
but must remember command paths and switch between separate invocations to
inspect and modify related resources.

Porkbun's web Domain Management interface presents a portfolio-oriented model:

- search, filter, and select domains;
- see expiration, renewal, privacy, lock, hosting, email, and marketplace
  status;
- open a domain details area;
- manage DNS, nameservers, glue, forwarding, SSL, DNSSEC, transfers, and
  renewal;
- apply selected actions to multiple domains.

The public API exposes a substantial but smaller feature set. The TUI can
provide a coherent interactive experience for that API-backed subset without
changing the CLI's role as an unofficial client.

## 3. Problem Statement

Human users lack a fast, discoverable way to:

1. inspect a large domain portfolio without composing multiple CLI commands;
2. move from a domain to its DNS, nameserver, forwarding, DNSSEC, SSL, renewal,
   and transfer workflows without memorizing syntax;
3. review a mutation and its consequences before execution;
4. perform repeated or bulk operations while retaining a clear per-domain
   result;
5. understand which Porkbun web features are unavailable through the API.

The result is unnecessary context switching to the website or repeated command
construction for ordinary account management.

## 4. Goals

### 4.1 Product goals

- Provide a keyboard-driven portfolio browser for Porkbun domains.
- Cover all domain-management operations currently exposed by Porkbun API v3.
- Match the web interface's domain-centric organization where practical.
- Make common tasks discoverable through visible actions and contextual help.
- Preserve or improve the existing CLI's safety guarantees for mutations,
  purchases, secrets, and partial failures.
- Support accounts ranging from a few domains to at least 10,000 domains.
- Work in common macOS and Linux terminals supported by Node.js 20.11+.
- Keep the TUI optional so existing automation behavior and install paths do not
  regress.

### 4.2 Engineering goals

- Reuse `ApiClient`, credential resolution, `CliError`, operation metadata, and
  request construction rather than invoking the `porkbun` executable as a
  subprocess.
- Separate domain/API state from rendering so workflows can be tested without a
  real terminal.
- Use deterministic state transitions and explicit loading, empty, error,
  confirmation, and success states.
- Add no implicit telemetry and never persist API responses containing secrets.

## 5. Non-goals

- Full parity with Porkbun web features that are absent from the public API.
- Browser automation, HTML scraping, or use of undocumented private endpoints.
- Replacing the existing command-oriented CLI.
- Account billing, payment method, cart, checkout, hosting purchase, or account
  security management.
- A reseller, multi-tenant, or delegated administration console.
- A graphical desktop or web application.
- Automatic DNS changes based on inferred intent.
- Background daemon behavior or scheduled renewal/DNS jobs.
- Storing complete portfolio data or secrets in a local database.

## 6. Users and Primary Use Cases

### 6.1 Primary user: individual domain owner

Manages a small portfolio and wants a discoverable alternative to the website
for checking expiration, updating DNS, changing nameservers, or renewing a
domain.

### 6.2 Primary user: developer or operator

Manages many domains and needs fast search, keyboard navigation, structured
record editing, SSL retrieval, and clear mutation feedback.

### 6.3 Secondary user: automation-oriented CLI user

Normally uses structured commands but enters the TUI for exploration,
troubleshooting, or selecting the correct domain/record before returning to
automation.

### 6.4 Core jobs to be done

- Find a domain by name, TLD, label, expiration, auto-renew, or API access.
- Identify domains that need attention.
- Inspect all API-visible details for one domain.
- Create, edit, and delete DNS records.
- Update nameservers and glue records.
- Add and delete URL forwards.
- View and manage registry DNSSEC records.
- Toggle auto-renew.
- Check availability, register, renew, or transfer a domain using account
  credit.
- Monitor active inbound transfers.
- Retrieve an SSL certificate bundle without exposing private material on
  screen.
- Perform a supported action across selected domains and inspect partial
  failures.

## 7. Research and Product Constraints

### 7.1 Official web interface capabilities

Porkbun documents the following Domain Management capabilities:

- registration and bulk search;
- domain search and label filtering;
- external domains and display settings;
- bulk management;
- DNS, nameservers, glue, URL forwarding, DNSSEC, SSL, and API access;
- renewals and auto-renew;
- registrar lock and transfer-out authorization;
- WHOIS privacy and domain contacts;
- email and web hosting;
- parking;
- account-to-account domain pushes;
- marketplace sale and auction management.

### 7.2 Public API capabilities

The official Porkbun API v3 currently exposes:

- domain availability, registration, renewal, inbound transfer, transfer
  status, portfolio listing, and domain detail;
- auto-renew updates;
- nameserver and glue record management;
- URL forward listing, creation, and deletion;
- DNS record CRUD and registry DNSSEC record management;
- SSL bundle retrieval;
- email hosting password updates;
- marketplace listing search;
- account balance, API spend settings, and account invites;
- public TLD pricing.

### 7.3 Capability policy

The TUI must use only documented operations in the bundled or current official
OpenAPI specification. Any new API operation must first be added to the shared
operation layer and exposed consistently to both CLI and TUI where appropriate.

The following web features are out of executable scope until Porkbun publishes
an API for them:

- creating, editing, or assigning labels;
- adding external domains;
- changing domain contacts;
- registrar lock/unlock, transfer-out authorization, or transfer-out approval;
- WHOIS privacy mode;
- enabling API access for a domain;
- Porkbun-managed DNSSEC toggle as distinct from registry DNSSEC records;
- parking/resetting a domain;
- account-to-account pushes;
- email forwarding and mailbox lifecycle management;
- web/email hosting purchase and lifecycle management;
- marketplace listing, auction, or Afternic settings;
- deleting a registered or external domain;
- checkout, payment methods, and account settings not present in API v3.

Existing labels returned by `domain/listAll?includeLabels=yes` may be displayed
and filtered, but are read-only.

## 8. Scope and Priorities

| Capability | Priority | API support | Release |
| --- | --- | --- | --- |
| Credential/profile selection and validation | P0 | Yes | MVP |
| Domain list, search, sort, filter, pagination | P0 | Yes | MVP |
| Domain overview and attention indicators | P0 | Yes | MVP |
| DNS record list/create/edit/delete | P0 | Yes | MVP |
| Nameserver view/update | P0 | Yes | MVP |
| Auto-renew toggle | P0 | Yes | MVP |
| Account balance and API settings summary | P0 | Yes | MVP |
| URL forwarding list/add/delete | P1 | Yes | v1 |
| Glue record list/create/edit/delete | P1 | Yes | v1 |
| Registry DNSSEC list/create/delete | P1 | Yes | v1 |
| Availability check and registration | P1 | Yes | v1 |
| Manual renewal | P1 | Yes | v1 |
| Inbound transfer and transfer status | P1 | Yes | v1 |
| SSL bundle secure export | P1 | Yes | v1 |
| Bulk auto-renew and nameserver changes | P1 | Partial/composable | v1 |
| Marketplace browser | P2 | Read-only | Later |
| Email hosting password update | P2 | Yes | Later |
| Account invite workflow | P2 | Yes | Later |
| Web-only feature handoffs | P2 | No | Later |

P0 is the minimum useful release. The public `1.0` TUI is complete when P0 and
P1 acceptance criteria are met.

## 9. Information Architecture

### 9.1 Global layout

The default wide layout has four regions:

1. **Header:** product name, active profile/credential source, connection state,
   account balance, and active context.
2. **Navigation:** Domains, Transfers, Register, Account, and Help.
3. **Main content:** list, detail tabs, form, or operation result.
4. **Footer:** context-sensitive keybindings, loading/progress state, and latest
   non-sensitive status message.

The domain detail view has these API-backed tabs:

- Overview
- DNS
- Nameservers
- Glue
- Forwards
- DNSSEC
- SSL
- Transfer

### 9.2 Responsive behavior

- **120 columns or wider:** navigation, list, and detail may be shown together.
- **80-119 columns:** navigation collapses; list and detail are separate views.
- **60-79 columns:** compact single-pane mode with reduced columns.
- **Below 60 columns or 18 rows:** show a minimum-size message and allow exit;
  do not render a broken form.

The user can disable icons and color. Meaning must never depend on color alone.

## 10. Interaction Model

### 10.1 Global keys

| Key | Action |
| --- | --- |
| `?` | Open contextual help |
| `/` | Focus search/filter input |
| `Esc` | Close modal, cancel form, or navigate back |
| `q` | Quit when no modal/form has focus |
| `Ctrl+C` | Cancel active request when possible; otherwise request exit |
| `r` | Refresh the current resource |
| `Tab` / `Shift+Tab` | Move focus |
| Arrow keys | Navigate lists and fields |
| `j` / `k` | Optional list down/up aliases |
| `Enter` | Open or submit the focused item |
| `Space` | Toggle selection or checkbox |
| `:` | Open command palette |

Keys that would trigger mutations must open a review step; a single keypress
must never immediately change remote state.

### 10.2 Command palette

The command palette provides searchable actions filtered by current context.
Every action displays:

- action name;
- affected domain/resource;
- whether it is read-only, mutating, destructive, or billable;
- disabled reason when unavailable.

### 10.3 Mouse support

Mouse support is optional and must not be required. All functions must be
keyboard-accessible.

## 11. Detailed Functional Requirements

### 11.1 Startup and authentication

**TUI-AUTH-001:** `porkbun tui` must fail with a structured, human-readable
message when stdin or stdout is not a TTY.

**TUI-AUTH-002:** Credential precedence must remain flags, environment, then
saved profile, matching the existing CLI.

**TUI-AUTH-003:** `porkbun tui --profile <name>` must select a saved profile.

**TUI-AUTH-004:** If multiple saved profiles exist and no higher-precedence
credential source is selected, the startup screen must offer a profile picker.
Environment credentials must be identified as environment-sourced and never
displayed.

**TUI-AUTH-005:** Startup must validate credentials with `ping` and load account
balance/settings independently. Failure of optional account summary calls must
not prevent domain browsing.

**TUI-AUTH-006:** Authentication errors must offer retry, profile change, and
exit. The TUI must not include a form that echoes or persists secret keys in
MVP; users use `porkbun auth login`.

### 11.2 Domain portfolio

**TUI-DOM-001:** The domain list must show, when returned by the API:

- domain;
- status;
- expiration date and relative time;
- auto-renew status;
- API access status;
- TLD;
- labels;
- attention indicator.

**TUI-DOM-002:** Attention indicators must include:

- expired or API-reported inactive/error status;
- expires within 7, 30, or 90 days;
- auto-renew disabled;
- API access disabled;
- active/pending transfer where known.

**TUI-DOM-003:** Search must support case-insensitive domain substring matching
with a 150 ms maximum debounce.

**TUI-DOM-004:** Filters must include TLD, expiration window, auto-renew, API
access, status, and read-only labels.

**TUI-DOM-005:** Sort must include domain, expiration, TLD, auto-renew, and API
access in ascending or descending order.

**TUI-DOM-006:** The TUI must use API-side filters/sorts when supported and may
apply client-side refinement to loaded results. The UI must make incomplete
client-side result sets impossible to mistake for the entire account.

**TUI-DOM-007:** Pagination must load bounded pages and support explicit next,
previous, and load-more actions. It must not issue one request per domain merely
to render the list.

**TUI-DOM-008:** Refresh must preserve the selected domain, active filters,
sort, and scroll position when the item still exists.

**TUI-DOM-009:** Multi-select must support individual and visible-page
selection. All-current-filter selection may be enabled only when API pagination
metadata permits the TUI to identify the complete set safely. The UI must state
exactly how many domains are selected and whether selection extends beyond
loaded rows.

### 11.3 Domain overview

**TUI-DETAIL-001:** Opening a domain must fetch the single-domain resource and
display all returned fields without exposing raw credentials.

**TUI-DETAIL-002:** The overview must show API support limitations for web-only
features in a non-blocking "Web-only capabilities" section.

**TUI-DETAIL-003:** A failure in one detail tab must be isolated to that tab and
must not discard data already loaded in other tabs.

**TUI-DETAIL-004:** Detail resources must be loaded lazily on first tab visit,
cached for the session, and explicitly refreshable.

### 11.4 DNS records

**TUI-DNS-001:** List records with type, name, content, TTL, priority, notes,
and ID.

**TUI-DNS-002:** Filter records by type, name, or content.

**TUI-DNS-003:** Create and edit forms must support all fields exposed by the
current API: type, name, content, TTL, priority, and notes.

**TUI-DNS-004:** Validation must be record-type aware where deterministic:

- require content and type;
- require numeric TTL and priority where applicable;
- validate IPv4 for A and IPv6 for AAAA;
- warn, but do not over-reject, complex TXT, CAA, and SRV values the API may
  accept.

**TUI-DNS-005:** Editing by record ID is the default. Name/type bulk edit and
delete may be offered only when the review screen clearly states that multiple
records can be affected.

**TUI-DNS-006:** Delete confirmation must display the complete record and
domain.

**TUI-DNS-007:** After a successful mutation, refresh records and keep focus
near the affected item.

### 11.5 Nameservers

**TUI-NS-001:** Display ordered authoritative nameservers.

**TUI-NS-002:** Update form must support adding, removing, reordering, and
validating hostname syntax.

**TUI-NS-003:** Review must show an old-versus-new diff and warn that changing
nameservers can disconnect Porkbun-managed DNS records and related services.

**TUI-NS-004:** Empty nameserver submission is prohibited unless a documented
API operation explicitly supports resetting to defaults.

### 11.6 Glue records

**TUI-GLUE-001:** List glue records and their IPv4/IPv6 addresses.

**TUI-GLUE-002:** Create/update forms must validate that the subdomain belongs
to the selected parent domain and that every address is a valid IP address.

**TUI-GLUE-003:** Delete review must show the hostname and all known addresses.

### 11.7 URL forwarding

**TUI-FWD-001:** List forwarding ID, subdomain, target location, redirect type,
path inclusion, and wildcard setting when returned.

**TUI-FWD-002:** Add form must support subdomain, target URL, permanent or
temporary type, include-path, and wildcard.

**TUI-FWD-003:** Target URLs must use `http` or `https`. The form must explain
that the API does not expose forward editing; users replace a forward by
deleting and adding it.

### 11.8 DNSSEC

**TUI-DNSSEC-001:** List registry DNSSEC records.

**TUI-DNSSEC-002:** Create form must support every API field, separating common
DS fields from advanced key-data fields.

**TUI-DNSSEC-003:** Delete must require explicit confirmation of domain and key
tag.

**TUI-DNSSEC-004:** The UI must distinguish registry DNSSEC records from the
web-only Porkbun DNSSEC convenience toggle.

### 11.9 Auto-renew and renewal

**TUI-RENEW-001:** Toggle auto-renew for one or multiple selected domains.

**TUI-RENEW-002:** The review screen must show the previous and requested state
for each domain.

**TUI-RENEW-003:** Manual renewal must retrieve current renewal pricing where
possible and require the user to review the exact domain, expected charge in
USD, charge in API pennies, and current account balance.

**TUI-RENEW-004:** If price cannot be established reliably, disable submission
rather than guessing the `cost`.

**TUI-RENEW-005:** A successful renewal must refresh domain expiration and
account balance.

### 11.10 Registration

**TUI-REG-001:** Accept one fully qualified domain name per availability check
in v1.

**TUI-REG-002:** Show availability, registration price, renewal price when
available, premium/special status, and account balance.

**TUI-REG-003:** Registration review must show the exact name, expected cost,
terms acknowledgement, and the fact that registration is billable and normally
irreversible.

**TUI-REG-004:** The final submit step must require typing the domain name or a
comparably strong explicit confirmation. The API's `agreeToTerms` value must
only be sent after this confirmation.

**TUI-REG-005:** Refresh balance and portfolio after success.

### 11.11 Transfers

**TUI-XFER-001:** List active inbound transfers with domain, status,
description, and transfer date.

**TUI-XFER-002:** Permit transfer initiation with domain, authorization code,
and API-provided expected cost.

**TUI-XFER-003:** Treat authorization codes as sensitive: mask by default,
never include them in logs/errors, and discard them after submission or form
exit.

**TUI-XFER-004:** Provide a transfer detail/status refresh action.

**TUI-XFER-005:** Transfer-out workflows must be marked web-only.

### 11.12 SSL bundle

**TUI-SSL-001:** Fetch SSL data only after an explicit user action, not during
background tab prefetch.

**TUI-SSL-002:** Never render a private key or full certificate material in the
normal viewport, status line, error details, or debug logs.

**TUI-SSL-003:** Permit secure export to a user-selected directory with
predictable filenames, directory mode `0700` when created, private key mode
`0600`, and certificate files no broader than `0644`.

**TUI-SSL-004:** Refuse silent overwrite. Show existing targets and require
explicit overwrite confirmation.

**TUI-SSL-005:** On success, show file paths and certificate metadata, not
private contents.

### 11.13 Bulk operations

**TUI-BULK-001:** v1 bulk actions are limited to operations that are supported
consistently across selected domains:

- auto-renew change;
- nameserver replacement;
- adding a DNS record;
- adding a URL forward;
- manual refresh/export of a result summary.

**TUI-BULK-002:** Before execution, display:

- selected domain count and filter scope;
- exact intended operation;
- destructive/replacement warning;
- estimated API call count;
- billable total where applicable;
- unavailable domains and reasons.

**TUI-BULK-003:** Execute with bounded concurrency, default 3 and maximum 10.

**TUI-BULK-004:** Every domain must have an independent result state: pending,
running, succeeded, failed, skipped, or cancelled.

**TUI-BULK-005:** Failure must not roll back unrelated successful operations or
silently retry a non-idempotent request. Existing deterministic idempotency
keys must be reused.

**TUI-BULK-006:** Allow retry of failed items only, preserving the original
reviewed payload unless the user returns to edit.

**TUI-BULK-007:** Bulk DNS, nameserver, and forwarding replacement warnings
must explicitly note that these changes can disrupt all selected domains.

### 11.14 Account summary

**TUI-ACCT-001:** Show account credit balance and API spend settings when
available.

**TUI-ACCT-002:** Do not display payment instruments, account passwords, API
keys, or secret keys.

**TUI-ACCT-003:** Account data must have independent loading and error states.

### 11.15 Help and web-only handoffs

**TUI-HELP-001:** Contextual help must list current keys, action descriptions,
and safety implications.

**TUI-HELP-002:** Unsupported features must state "Not available in Porkbun API
v3" rather than appearing broken or disabled without explanation.

**TUI-HELP-003:** Where an official article exists, show a copyable HTTPS URL.
The TUI must not automatically open a browser without a distinct user action.

## 12. Mutation Safety Model

Every mutation follows the same state machine:

```text
edit -> validate -> review -> confirm -> submit -> reconcile -> result
```

Requirements:

- Forms are never submitted directly from an editable field.
- Review screens show normalized request data with secrets redacted.
- Destructive actions use a danger label and explicit confirmation.
- Billable actions use a billable label, exact expected cost, and strong
  confirmation.
- The user can return from review to edit without losing input.
- The submit action is disabled while a request is in flight.
- Deterministic idempotency keys remain the default.
- Request IDs from API failures are shown for support correlation.
- Closing the TUI during an in-flight mutation must not report an unknown result
  as success. On restart, the user is instructed to refresh the resource.

Confirmation levels:

| Level | Examples | Required confirmation |
| --- | --- | --- |
| Standard | Add DNS record, add forward | Review + confirm key |
| Disruptive | Change nameservers, delete DNS/DNSSEC/glue/forward | Review + explicit confirm |
| Bulk disruptive | Apply DNS/nameservers/forward to many domains | Review + type selected count |
| Billable | Register, renew, inbound transfer | Review + type domain; bulk billing is out of scope |

## 13. Error, Loading, and Offline Behavior

### 13.1 Error categories

Use existing `CliError` categories and add TUI presentation for:

- authentication;
- authorization/API access disabled;
- validation/usage;
- network;
- timeout;
- rate limit;
- Porkbun API/business rule;
- unexpected internal error.

### 13.2 Requirements

- Loading indicators must identify the resource being loaded.
- Read requests may be cancelled or superseded when navigation changes.
- Mutating requests must not be abandoned at the application layer after being
  sent; their eventual result must be reconciled when possible.
- Rate-limit errors must display reset/retry information when provided.
- Retry controls must be available for retryable reads.
- Stale cached content may remain visible with a clear stale/error marker.
- Empty states must distinguish "no resources", "no filter matches", and "not
  available through API".
- No offline mutation queue is permitted.

## 14. Technical Approach

### 14.1 Framework decision

Use **Ink with React** for the initial implementation, subject to a short
prototype validating list performance and terminal restoration.

Rationale:

- Ink supports Node.js and TypeScript, matching the package's existing runtime.
- It provides component composition, input handling, and Flexbox-style layout.
- It can be tested by rendering components and simulating input.
- OpenTUI is not selected because its official documentation currently states
  that it is Bun-exclusive, while this project supports Node.js 20.11+ and uses
  npm.

The prototype must prove:

- smooth navigation with 10,000 in-memory domain rows using virtualization or
  bounded rendering;
- correct alternate-screen entry/exit;
- reliable resize handling;
- deterministic input tests;
- acceptable install size and startup time.

If Ink cannot meet these gates, framework selection returns to review; the
product and service requirements in this PRD remain unchanged.

### 14.2 Proposed module boundaries

```text
src/
  tui/
    index.tsx              # TTY checks and Ink lifecycle
    app.tsx                # root state and route composition
    routes.ts              # typed navigation state
    components/            # reusable visual primitives
    screens/               # portfolio, detail tabs, forms, results
    forms/                 # validation and normalized form models
    state/                 # reducers/controllers and request state
    services/              # TUI-facing API/domain services
    keymap.ts              # centralized key definitions
    theme.ts               # color and no-color semantics
    redact.ts              # UI-specific sensitive-value guards
```

Shared code should be extracted only where needed:

- API operations remain in `src/lib/operations.ts`.
- `ApiClient` remains the sole HTTP implementation.
- credential and error behavior remain in existing libraries.
- CLI command definitions must not become the TUI's data model.
- shared request builders may be introduced when both CLI and TUI need the same
  normalization.

### 14.3 State model

State is divided into:

- **session:** profile, credential source, terminal capabilities, account
  summary;
- **navigation:** route, selected domain, active tab, modal stack;
- **portfolio query:** server filters, client search, sort, pagination;
- **resource cache:** keyed domain detail resources with fetched/stale/error
  metadata;
- **form state:** values, validation, review snapshot, sensitive fields;
- **operation state:** request ID, idempotency key, progress, result;
- **selection:** explicit selected IDs or filter-based selection descriptor.

Do not place private keys, API secrets, transfer authorization codes, or email
passwords in long-lived global state.

### 14.4 Data fetching and cache

- Session-memory cache only.
- Default domain page size: 100.
- Deduplicate concurrent reads for the same resource key.
- Default freshness: 30 seconds for domain lists and details; manual refresh is
  always available.
- Invalidate affected keys after mutation.
- No API response cache is written to disk.
- Exit clears all in-memory state.

### 14.5 CLI integration

- Register a `tui` command outside the generated operation command hierarchy.
- Global auth/network options that are meaningful to the TUI remain supported:
  `--profile`, credential flags, `--base-url`, `--ipv4`, `--timeout`,
  `--verbose`, and `--no-color`.
- Output options, `--fields`, `--limit`, `--offset`, `--dry-run`, and `--yes`
  do not control the interactive UI and must be rejected with a clear message
  when supplied with `porkbun tui`.
- `porkbun tui --help` must document TTY requirements and key options.

## 15. Security and Privacy Requirements

- Preserve the existing restriction against sending credentials to an
  unapproved origin.
- Never include credentials, private keys, passwords, transfer codes, or full
  SSL bundle contents in rendered errors or verbose logs.
- Avoid command-line secret inputs in TUI workflows.
- Mask sensitive form fields and clear them on submit/cancel.
- Prevent terminal escape injection by sanitizing untrusted API strings before
  rendering. Strip control characters except explicitly handled line breaks and
  tabs.
- Bound rendered field lengths and provide a safe detail viewer for long
  values.
- Export private key material only under the permissions defined in
  `TUI-SSL-003`.
- Do not write domain lists, activity history, or form drafts to disk by
  default.
- Do not collect analytics or telemetry.
- Dependency review must include license, maintenance, transitive dependency,
  terminal input, and ANSI rendering risks.

## 16. Accessibility and Usability

- All actions are keyboard-accessible.
- Focus is always visible using color plus a non-color marker.
- Status is conveyed by text/symbol and not color alone.
- `--no-color` provides equivalent information.
- Use plain-text fallbacks for Unicode symbols when terminal capability is
  uncertain.
- Forms provide field-level errors and a summary on submit.
- Help text uses consistent verbs and key names.
- Date displays include an unambiguous ISO date; relative time is supplemental.
- Monetary values display currency and API penny conversion.
- Destructive, billable, and web-only labels use consistent wording.

## 17. Performance and Reliability Targets

- First frame within 300 ms after local startup work, excluding network calls,
  on a typical supported development machine.
- Interactive startup remains usable while account/domain requests load.
- Domain list navigation renders within 50 ms per input event for 10,000
  in-memory records.
- Search feedback appears within 200 ms.
- No more than 100 domain rows are rendered simultaneously unless the prototype
  demonstrates equivalent performance.
- Default bulk concurrency is 3.
- The terminal cursor, input mode, and alternate screen are restored after
  normal exit, `Ctrl+C`, handled errors, and rejected startup.
- Resize events must not crash the process or lose form values.

## 18. Testing Strategy

### 18.1 Unit tests

- reducers and navigation transitions;
- filters, sorting, pagination, and selection;
- form validation and request normalization;
- price/penny conversion;
- attention indicators and date thresholds;
- redaction and control-character sanitization;
- confirmation-level assignment;
- cache invalidation;
- bulk scheduling and partial failure handling.

### 18.2 Component tests

- render every loading, empty, populated, stale, error, review, and result state;
- keyboard navigation and focus;
- no-color and compact layouts;
- modal and form cancellation;
- prevention of direct mutation from edit state;
- secret masking and absence from snapshots.

### 18.3 Integration tests

Use a local HTTP server, as current CLI tests do, to verify:

- startup and credential validation;
- portfolio loading and pagination;
- domain-to-detail navigation;
- DNS CRUD;
- mutation confirmation and idempotency headers;
- rate limits, timeout, malformed data, and API errors;
- post-mutation cache invalidation;
- SSL export permissions and overwrite refusal.

### 18.4 End-to-end terminal tests

Run the built CLI under a pseudo-terminal to verify:

- TTY detection;
- key sequences and resize behavior;
- alternate-screen cleanup;
- `Ctrl+C` semantics;
- minimum terminal size;
- full representative workflows;
- no secrets in captured terminal output.

### 18.5 Manual validation matrix

At minimum:

- macOS Terminal;
- iTerm2;
- a Linux terminal such as GNOME Terminal;
- tmux;
- SSH session;
- 80x24 and wide layouts;
- light/dark themes;
- color and no-color;
- slow, failed, and rate-limited API responses.

## 19. Delivery Plan

### Phase 0: framework and architecture spike

- Add isolated Ink prototype.
- Validate performance, resize, exit restoration, and testing.
- Finalize component and state conventions.

Exit criteria: all framework gates in section 14.1 pass.

### Phase 1: read-only portfolio MVP

- `porkbun tui` startup/auth.
- Header, navigation, domain list, search/filter/sort/pagination.
- Domain overview.
- Read-only DNS, nameservers, balance/settings.
- Help, errors, loading, responsive layouts.

Exit criteria: a user can find and inspect any API-visible domain without
leaving the TUI.

### Phase 2: core mutations

- DNS CRUD.
- Nameserver update.
- Auto-renew.
- Shared form/review/confirmation/result framework.
- Mutation integration and pseudo-terminal tests.

Exit criteria: P0 requirements and safety tests pass.

### Phase 3: complete API-backed domain management

- Glue, forwards, registry DNSSEC.
- Availability, registration, renewal.
- Inbound transfers and status.
- Secure SSL export.
- Supported bulk actions.

Exit criteria: all P1 requirements and public v1 acceptance criteria pass.

### Phase 4: secondary API surfaces

- Marketplace browser.
- Email password reset.
- Account invite workflow.
- Web-only knowledge-base handoffs.

## 20. Success Metrics

No telemetry will be added. Success is evaluated through release testing, issue
reports, and opt-in user feedback.

Target outcomes:

- 100% of P0/P1 API-backed workflows can be completed without memorizing a
  non-interactive command.
- 100% of remote mutations pass through review and confirmation.
- Zero known credential/private-key leaks in tests, snapshots, logs, or issue
  reproductions.
- Zero terminal-state restoration failures in the supported validation matrix.
- Portfolio search remains responsive at 10,000 domains.
- All existing CLI tests and behavior remain passing.

## 21. Release Acceptance Criteria

The TUI v1 is ready when:

1. `porkbun tui` is available from the packaged binary and rejects non-TTY use.
2. The user can select/resolve credentials and see a domain portfolio.
3. Search, sort, filters, pagination, refresh, and responsive layouts work.
4. Domain overview, DNS, nameservers, glue, forwarding, registry DNSSEC, SSL,
   renewal, and transfer views meet this PRD.
5. DNS CRUD, nameserver update, auto-renew, glue, forwarding, DNSSEC,
   registration, renewal, inbound transfer, and SSL export are implemented with
   required safety controls.
6. Bulk operations produce explicit per-domain results and partial failures.
7. Web-only features are accurately identified as unsupported by API v3.
8. Existing CLI commands and structured output contracts have no regressions.
9. Unit, component, integration, and pseudo-terminal test suites pass.
10. `npm test` passes on the minimum supported Node.js version.
11. Security review finds no secret rendering, unsafe export permissions,
    terminal injection, or credential-origin regression.
12. User documentation covers launch, navigation, credentials, safety, API
    limitations, and troubleshooting.

## 22. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Web/API parity gap creates false expectations | High | Publish the capability matrix and label web-only actions explicitly |
| Large portfolios make rendering slow | High | Server pagination, bounded rows, virtualization, performance gate |
| TUI framework increases install size/complexity | Medium | Optional architecture review, prototype gate, dependency audit |
| Terminal differences break input or cleanup | High | PTY tests and manual terminal matrix |
| Bulk actions cause widespread disruption | High | Narrow scope, review diff, strong confirmation, low concurrency |
| Billing price changes between review and submit | High | Use API check/current pricing immediately before submit and require exact expected cost |
| API access is disabled on a domain | Medium | Clear authorization state and official instructions; no private endpoint workaround |
| SSL private key leaks to screen or disk | Critical | No content rendering, redaction tests, secure export modes |
| API changes outpace bundled spec | Medium | Keep operation layer/spec update process; fail clearly on unknown shapes |
| Interrupted mutation leaves uncertain state | Medium | Idempotency, request status messaging, targeted refresh/reconciliation |

## 23. Open Questions

These do not block the PRD but must be resolved before their phase begins:

1. Does the domain list endpoint return enough total/pagination metadata to
   implement "select all matching" safely, or must v1 limit bulk selection to
   loaded pages?
2. Which label fields and shapes are returned by `includeLabels=yes`, and are
   they stable enough for read-only filtering?
3. Can current pricing plus domain-check responses reliably establish renewal
   and transfer cost immediately before a billable request for premium TLDs?
4. Should SSL export default to the current directory, an XDG data directory,
   or require an explicit path every time? The security preference is explicit
   path.
5. Should package size justify publishing TUI dependencies as optional
   dependencies or a separate package? The default assumption is one package
   until the framework spike measures the impact.
6. Which bulk operations are natively atomic/multi-domain in Porkbun API v3
   versus composed client-side calls, and how does each endpoint report partial
   failure?
7. Are screen-reader-friendly terminal modes practical enough to include in v1,
   or should a documented non-interactive CLI fallback remain the supported
   accessible mode?

## 24. Official References

- Porkbun API v3 documentation and OpenAPI specification:
  <https://porkbun.com/api/json/v3/documentation>
- Porkbun Domain Management overview:
  <https://kb.porkbun.com/article/173-how-to-use-domain-management>
- Porkbun Domain Details overview:
  <https://kb.porkbun.com/article/175-how-to-use-the-domain-details-area>
- Porkbun Bulk Manage guide:
  <https://kb.porkbun.com/article/49-how-to-use-bulk-manage-to-modify-several-domains-at-once>
- Porkbun API setup and per-domain API access:
  <https://kb.porkbun.com/article/190-getting-started-with-the-porkbun-api>
- Porkbun renewal guide:
  <https://kb.porkbun.com/article/45-how-to-renew-domain-name>
- Porkbun WHOIS privacy guide:
  <https://kb.porkbun.com/article/97-how-to-configure-whois-privacy-service-porkbun>
- Porkbun transfer-out guide:
  <https://kb.porkbun.com/article/27-how-to-transfer-domain-from-porkbun-to-another-registrar>
- Ink:
  <https://github.com/vadimdemedes/ink>
- OpenTUI runtime requirements:
  <https://opentui.com/docs/getting-started/>
