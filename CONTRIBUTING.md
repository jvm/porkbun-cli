# Contributing

## Development

Requirements:

- Node.js 20.11 or newer
- npm

Install and verify:

```sh
npm ci
npm test
```

Keep changes focused, add tests for behavior changes, and update documentation when commands or output contracts change.

## Pull Requests

- Create a feature branch from `main`.
- Use imperative, concise commit messages.
- Do not commit credentials, local configuration, generated `dist/` files, or `node_modules/`.
- Run `npm test` before opening a pull request.
- Describe user-visible behavior, security implications, and validation performed.

## Security

Do not report vulnerabilities in public issues. Follow [SECURITY.md](SECURITY.md).
