# Contributing to Aegis

## Development setup

```bash
git clone <repo>
cd aegis
npm install
npm run build
```

Open the project in VS Code and press `F5` to launch the Extension Development Host.

## Before submitting a PR

1. `npm run typecheck` — zero errors
2. `npm run lint` — zero warnings
3. `npm run test -- --coverage` — all tests pass, coverage thresholds met
4. `npm run package` — VSIX builds cleanly

## Code style

- TypeScript strict mode, no `any` without justification
- No `console.*` in `src/` — use the extension's logging service (added in M2+)
- Keep the offline guarantee intact — never add a network call outside the allow-list in `src/net/guard.ts`

## Commit messages

Use the imperative mood: "Add entropy scanner", not "Added" or "Adding".

## License

By contributing you agree that your contributions will be licensed under Apache-2.0.
