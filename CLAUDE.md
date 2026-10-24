# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Commands

```bash
npm test             # Vitest unit tests (tests/**/*.test.ts)
npm run lint         # biome check . && n8n-node lint
npm run format       # biome check --write .
npm run typecheck    # tsc -p tsconfig.typecheck.json (sources + tests)
npm run build        # n8n-node build: rimraf dist, tsc, copy svg/json
npm run dev          # n8n-node dev: local n8n container with this node loaded
npm run release      # n8n-node release (release-it, needs npm login)
```

Requires Node >= 24. Zero runtime dependencies; HTTP only via `this.helpers.httpRequest`.

## Architecture

`@fjacquet/n8n-nodes-getbring` is a TypeScript port of Python miaucl/bring-api. One node, one credential.

- `credentials/BringApi.credentials.ts`: email and password; the test request POSTs `v2/bringauth`.
- `nodes/Bring/Bring.node.ts`: `execute()` and the `searchLists` list-search method. Item resource goes through `executeItems`; List and Catalog run per input item.
- `nodes/Bring/transport.ts`: `bringLogin`, `bringRequest`, `getListLocale`. Ports `Bring.login`, `_request`, user settings.
- `nodes/Bring/translation.ts`: catalogs (`locales/articles.<locale>.json`), `toKey`, `toName`, `mapUserLocale`.
- `nodes/Bring/batch.ts`: `buildChange`, `buildBody` (port of `batch_update_list`).
- `nodes/Bring/items.ts`: `planBatches` groups changes per list.
- `nodes/Bring/lists.ts`: `resolveListUuid`, `mapListItems`.
- `nodes/Bring/descriptions/`: `INodeProperties` for List, Item and Catalog. `listLocator` (resourceLocator: list, id, name) is shared.

Files that port bring-api logic start with a one-line comment naming the Python function.

## Key patterns

- Login once per execution: `getSession()` memoizes the promise, failed or not. Login is lazy; Catalog with a fixed locale needs no account.
- Errors are sanitized in `send()` (transport.ts): only a message and HTTP code are kept, never the request, password or token. Login 401 maps to a fixed message.
- Translation: default locale `de-CH` means no translation. `toKey` trims, then exact display name, then case-insensitive display name, then key; reversed catalog order so the last duplicate wins (as bring-api). No fuzzy or plural matching. Unknown names stay as custom items. Account locale outside the 20 falls back by language, then `de-CH`.
- Batching: `executeItems` builds every change first, groups by list, sends one PUT per list. Without continueOnFail any planning error throws before any write. Lists are written sequentially, so a later failure leaves earlier lists written.
- Remove and Complete without a uuid send no `uuid` key; Bring then targets the newest match by name. Add always sends a uuid.
- Resource has `noDataExpression`, so it is read once (item 0) to pick the item path.
- The Bring API key in `transport.ts` is the public key from Bring's Android app (same as bring-api), with an eslint-disable for the secret rule.
- No `console.*`.

## Code style

- Tabs (width 2), semicolons, trailing commas, single quotes, LF, print width 100. Enforced by Biome (`biome.json`).
- `eslint.config.mjs` must stay the `@n8n/node-cli/eslint` default.
- Option lists must stay alphabetical for `n8n-node lint`.
- TDD: tests in `tests/` (Vitest); write the failing test first.
- Disclaimer in README must stay verbatim; LICENSE keeps the bring-api copyright lines.

@AGENTS.md
