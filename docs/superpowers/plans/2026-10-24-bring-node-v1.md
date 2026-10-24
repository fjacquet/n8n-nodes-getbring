# Bring n8n node v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publishable n8n community node `n8n-nodes-getbring` (List / Item / Catalog) porting miaucl/bring-api to TypeScript, with catalog translation.

**Architecture:** Programmatic node scaffolded by `@n8n/node-cli`. Pure logic (translation, batch body) in small modules unit-tested with vitest; a thin transport module wraps `this.helpers.httpRequest` (login per execution, Bring headers); `Bring.node.ts` wires descriptions and execute. Locale catalogs are bundled JSON copied from bring-api.

**Tech Stack:** TypeScript 5.9, `@n8n/node-cli` 0.53.4 (build/lint/release), `n8n-workflow` (peer), vitest (dev only), Docker n8n for the live test.

**Spec:** `docs/superpowers/specs/2026-10-24-bring-node-design.md`

**Reference source:** bring-api cloned at `/private/tmp/claude-501/-Users-fjacquet-Projects-n8n-nodes-getbring/ab926e18-8477-435f-ab83-b6a8382ca7ef/scratchpad/src/bring-api` (re-clone `https://github.com/miaucl/bring-api` if missing). Line refs below are to `bring_api/bring.py`.

## Global Constraints

- Package name `@fjacquet/n8n-nodes-getbring`, license MIT, keyword `n8n-community-node-package`.
- Zero runtime `dependencies` in package.json; HTTP only via `this.helpers.httpRequest`.
- `npm run lint` (n8n-node lint) and `npx @n8n/scan-community-package` must pass before release.
- API base `https://api.getbring.com/rest/`; headers `X-BRING-API-KEY: cof4Nc6D8saplXjE3h3HXqHH8m7VU2i1Gs0g85Sp`, `X-BRING-CLIENT: android`, `X-BRING-APPLICATION: bring`, `X-BRING-COUNTRY: <userLocale.country>`, `X-BRING-USER-UUID`, `X-BRING-PUBLIC-USER-UUID`, `Authorization: <token_type> <access_token>`.
- Default locale `de-CH` = no translation. 20 supported locales = `BRING_SUPPORTED_LOCALES` in `bring_api/const.py`.
- Never put password or token in node output, error messages or logs.
- Disclaimer verbatim: "The developers of this module are in no way endorsed by or affiliated with Bring! Labs AG, or any associated subsidiaries, logos or trademarks."
- LICENSE keeps `Copyright (c) 2024 Cyrill Raccaud` and `Copyright (c) 2024 Manfred Dennerlein Rodelo` lines (copy exact lines from bring-api LICENSE), then `Copyright (c) 2026 Frederic Jacquet`.
- Files porting bring-api logic start with a one-line comment naming the Python function they port.
- Icon: generic shopping-basket SVG, never the Bring! logo.

## Review Focus

1. Name with stray whitespace or different case ("  OIGNONS ") → trimmed, matched to `Zwiebeln` (Task 2 test).
2. Empty or whitespace-only item name → that item errors, the rest of the batch still goes (Task 6 test).
3. Account locale not in the 20 (e.g. `fr-BE`) → falls back to `fr-FR`; unknown language → `de-CH`, no translation (Task 2 test).
4. List "By Name" not found or matching two lists → explicit `NodeOperationError` naming the list (Task 5 test).
5. Wrong email/password → 401 surfaced as "Bring login failed: invalid email or password", body never echoed (Task 4 test).

---

### Task 1: Scaffold project, license, bundled data

**Files:**
- Create (via CLI, then move into repo root): `package.json`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc.js`, `.gitignore`, `.github/workflows/{ci,publish}.yml`, `AGENTS.md`, `.agents/*`
- Create: `LICENSE`, `nodes/Bring/locales/articles.<locale>.json` (20 files), `test/fixtures/*.json`, `vitest.config.ts`
- Delete: scaffold `nodes/Example/*`, scaffold `CLAUDE.md` only if it duplicates `AGENTS.md`

- [ ] **Step 1:** Generate in scratchpad: `npx -y @n8n/node-cli@0.53.4 new n8n-nodes-getbring --skip-install --template programmatic/example`, copy contents (not `.git`) into repo root. Keep repo's `docs/`.
- [ ] **Step 2:** package.json: `description`, `homepage`/`repository` = `https://github.com/fjacquet/n8n-nodes-getbring` (confirm owner with Fred before first push), add `"test": "vitest run"`, devDependency `vitest`. Pin `@n8n/node-cli` to `0.53.4` instead of `*`.
- [ ] **Step 3:** Copy `bring_api/locales/*.json` → `nodes/Bring/locales/`, `tests/fixtures/{login,user_account,user_settings,load_lists,get_list,error}_response.json` → `test/fixtures/`. Write LICENSE per Global Constraints.
- [ ] **Step 4:** `npm install && npm run build` → exits 0. Commit `chore: scaffold n8n community node`.

### Task 2: Translation module

**Files:**
- Create: `nodes/Bring/translation.ts`
- Test: `test/translation.test.ts`

**Interfaces:**
- Produces:
  - `export const DEFAULT_LOCALE = 'de-CH'`, `export const SUPPORTED_LOCALES: readonly string[]`, `MAP_LANG_TO_LOCALE` (from const.py)
  - `export type Catalog = Record<string, string>` (key → display name)
  - `export function getCatalog(locale: string): Catalog` — static `import` of each JSON into a map; throws for unsupported locale
  - `export function mapUserLocale(language: string, country: string): string` — port `map_user_language_to_locale` (l.1008)
  - `export function toKey(name: string, locale: string): string` — port `__translate(from_locale)` (l.869)
  - `export function toName(key: string, locale: string): string` — port `__translate(to_locale)`

Matching for `toKey`, in order: trim input; locale `de-CH` → return trimmed; exact display-name match → key; case-insensitive display-name match → key; case-insensitive key match → canonical key; else trimmed input. `toName`: `de-CH` → key; else catalog[key] ?? key.

- [ ] **Step 1: Write failing tests**

```ts
expect(toKey('Oignons', 'fr-CH')).toBe('Zwiebeln');
expect(toKey('  OIGNONS ', 'fr-CH')).toBe('Zwiebeln');
expect(toKey('Huile d\'olive', 'fr-CH')).toBe('Olivenöl');
expect(toKey('Zwiebeln', 'fr-CH')).toBe('Zwiebeln');
expect(toKey('zwiebeln', 'fr-CH')).toBe('Zwiebeln');
expect(toKey('Oignon', 'fr-CH')).toBe('Oignon');           // no fuzzy match
expect(toKey('Oignons', 'de-CH')).toBe('Oignons');         // default locale: untouched
expect(toName('Zwiebeln', 'fr-CH')).toBe('Oignons');
expect(toName('Unbekannt', 'fr-CH')).toBe('Unbekannt');
expect(mapUserLocale('fr', 'CH')).toBe('fr-CH');
expect(mapUserLocale('fr', 'BE')).toBe('fr-FR');
expect(mapUserLocale('xx', 'YY')).toBe('de-CH');
expect(Object.keys(getCatalog('fr-CH')).length).toBe(385);
expect(() => getCatalog('fr-BE')).toThrow();
```

(Values checked against bring-api `articles.fr-CH.json` on 2026-10-24.)

- [ ] **Step 2:** `npx vitest run test/translation.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement `translation.ts`.
- [ ] **Step 4:** Same command → PASS. `npm run build` → 0, and `dist/nodes/Bring/locales/` contains 20 files (else adjust tsconfig/import so build emits them).
- [ ] **Step 5:** Commit `feat: catalog translation ported from bring-api`.

### Task 3: Batch body builder

**Files:**
- Create: `nodes/Bring/batch.ts`
- Test: `test/batch.test.ts`

**Interfaces:**
- Consumes: `toKey` (Task 2)
- Produces:
  - `export type BringOperation = 'TO_PURCHASE' | 'TO_RECENTLY' | 'REMOVE'`
  - `export interface ItemInput { name: string; specification: string; uuid?: string }`
  - `export interface BringChange { itemId: string; spec: string; uuid: string; operation: BringOperation; accuracy: '0.0'; altitude: '0.0'; latitude: '0.0'; longitude: '0.0' }`
  - `export function buildChange(input: ItemInput, operation: BringOperation, locale: string, translate: boolean, newUuid: () => string): BringChange` — port of `batch_update_list` (l.1072). `uuid` = input.uuid, else `newUuid()` for TO_PURCHASE, else `''` (Bring then targets newest match by name). Throws `Error('Item name is empty')` when trimmed name is empty.
  - `export function buildBody(changes: BringChange[]): { changes: BringChange[]; sender: '' }`

- [ ] **Step 1: Failing tests**

```ts
const c = buildChange({ name: 'Oignons', specification: '2' }, 'TO_PURCHASE', 'fr-CH', true, () => 'u-1');
expect(c).toEqual({ itemId: 'Zwiebeln', spec: '2', uuid: 'u-1', operation: 'TO_PURCHASE', accuracy: '0.0', altitude: '0.0', latitude: '0.0', longitude: '0.0' });
expect(buildChange({ name: 'Oignons', specification: '' }, 'TO_PURCHASE', 'fr-CH', false, () => 'u').itemId).toBe('Oignons');
expect(buildChange({ name: 'Oignons', specification: '', uuid: 'abc' }, 'REMOVE', 'fr-CH', true, () => 'x').uuid).toBe('abc');
expect(buildChange({ name: 'Oignons', specification: '' }, 'REMOVE', 'fr-CH', true, () => 'x').uuid).toBe('');
expect(() => buildChange({ name: '  ', specification: '' }, 'TO_PURCHASE', 'fr-CH', true, () => 'x')).toThrow('Item name is empty');
expect(buildBody([c])).toEqual({ changes: [c], sender: '' });
```

- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** run → PASS.
- [ ] **Step 5:** Commit `feat: batch change builder`.

### Task 4: Credential and transport

**Files:**
- Create: `credentials/BringApi.credentials.ts`, `nodes/Bring/transport.ts`
- Modify: `package.json` (`n8n.credentials`)
- Test: `test/transport.test.ts` (fake `this` = `{ helpers: { httpRequest: vi.fn() }, getCredentials: vi.fn(), getNode: () => ({ name: 'Bring' }) }`, responses from `test/fixtures`)

**Interfaces:**
- Produces:
  - Credential name `bringApi`, display "Bring API", fields `email` (string), `password` (string, `typeOptions: { password: true }`). Credential `test`: POST `https://api.getbring.com/rest/v2/bringauth` form-urlencoded email/password.
  - `export interface BringSession { uuid: string; publicUuid: string; userLocale: string; headers: Record<string, string> }`
  - `export async function bringLogin(this: IExecuteFunctions | ILoadOptionsFunctions): Promise<BringSession>` — port `login` (l.200): POST `v2/bringauth` (form), then GET `v2/bringusers/{uuid}` → `userLocale` → `mapUserLocale`, `X-BRING-COUNTRY`.
  - `export async function bringRequest<T>(this: same, session: BringSession, method: IHttpRequestMethods, path: string, body?: IDataObject): Promise<T>` — base URL + session headers, JSON body.
  - `export async function getListLocale(this: same, session: BringSession, listUuid: string): Promise<string>` — GET `bringusersettings/{uuid}`, `listArticleLanguage` of that list, else `session.userLocale` (port `__locale`, l.988).
  - Errors: 401 on login → `NodeApiError` message `Bring login failed: invalid email or password`; other non-2xx → `NodeApiError` with Bring's message; never include request body.

- [ ] **Step 1: Failing tests:** login sends form body to `.../v2/bringauth` and returns session with `headers['X-BRING-USER-UUID']` = fixture uuid and `Authorization` = `Bearer <fixture access_token>`; `userLocale` from fixture account; `getListLocale` returns list setting from `user_settings_response.json` for a listed uuid and `session.userLocale` for an unknown one; login 401 → rejects with message above and `JSON.stringify(error)` does not contain the password.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** run → PASS; `npm run build` → 0.
- [ ] **Step 5:** Commit `feat: Bring credential and transport`.

### Task 5: Node shell, list selector, List resource

**Files:**
- Create: `nodes/Bring/Bring.node.ts`, `nodes/Bring/Bring.node.json`, `nodes/Bring/bring.svg`, `nodes/Bring/bring.dark.svg`, `nodes/Bring/descriptions/ListDescription.ts`, `nodes/Bring/lists.ts`
- Modify: `package.json` (`n8n.nodes` → `dist/nodes/Bring/Bring.node.js`)
- Test: `test/lists.test.ts`

**Interfaces:**
- Consumes: `bringLogin`, `bringRequest`, `getListLocale`, `toName`
- Produces:
  - Shared property `list` (`type: 'resourceLocator'`, modes `list` → `methods.listSearch.searchLists`, `name` (string), `id` (string)), exported from `ListDescription.ts` as `listLocator` for reuse.
  - `export function resolveListUuid(lists: { listUuid: string; name: string }[], locator: { mode: string; value: string }): string` in `lists.ts`; mode `name`: case-sensitive exact match, 0 hits → `Error('Bring list "<name>" not found')`, >1 → `Error('Several Bring lists are named "<name>"')`.
  - Operations: `list:getAll` → GET `bringusers/{uuid}/lists`, one item per list `{ listUuid, name, theme }`; `list:getItems` → GET `v2/bringlists/{listUuid}`, one item per article `{ key, name, specification, uuid, status: 'purchase'|'recently', listUuid }`, `recently` only when option `includeRecently` (default false).
  - Node: `usableAsTool: true` if lint allows, credential `bringApi`, one login per execution.

- [ ] **Step 1: Failing tests** for `resolveListUuid`: by id passthrough; by name "Maison" → uuid; not found message; duplicate message.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement `lists.ts`, descriptions, node shell + List operations. **Step 4:** tests PASS, `npm run build` and `npm run lint` → 0.
- [ ] **Step 5:** Commit `feat: Bring node with List resource`.

### Task 6: Item resource

**Files:**
- Create: `nodes/Bring/descriptions/ItemDescription.ts`, `nodes/Bring/items.ts`
- Modify: `nodes/Bring/Bring.node.ts`
- Test: `test/items.test.ts`

**Interfaces:**
- Consumes: `buildChange`, `buildBody`, `resolveListUuid`, `getListLocale`, `bringRequest`
- Produces:
  - Operations `item:add|remove|complete` → `TO_PURCHASE|REMOVE|TO_RECENTLY`. Fields: `list` (listLocator), `itemName` (string, required), `specification` (string), `itemUuid` (string, remove/complete only), options `translate` (boolean, default true).
  - `export function groupByList<T extends { listUuid: string }>(rows: T[]): Map<string, T[]>` (insertion order kept).
  - Execute: resolve list + build change per input item (per-item errors collected, not thrown yet); group by list; one PUT `v2/bringlists/{listUuid}/items` per group; on PUT failure every item of that group errors. Error handling: `continueOnFail()` → `{ json: { error }, pairedItem }` for each failed item; otherwise throw first error after building. Success output per item: input json + `{ key, name, specification, uuid, listUuid, operation }`, `pairedItem` set.

- [ ] **Step 1: Failing tests** (`items.test.ts`, pure parts): `groupByList` keeps order and groups two lists; a helper `planBatches(inputs, locale)` (export from `items.ts`) returns empty-name item as error entry and the others as one batch.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** tests PASS, build + lint → 0.
- [ ] **Step 5:** Commit `feat: Item resource with batched updates`.

### Task 7: Catalog resource

**Files:**
- Create: `nodes/Bring/descriptions/CatalogDescription.ts`
- Modify: `nodes/Bring/Bring.node.ts`

**Interfaces:**
- Consumes: `getCatalog`, `SUPPORTED_LOCALES`, `getListLocale`
- Produces: `catalog:get`; field `localeSource` (`list` | `locale`), `list` (listLocator, shown for `list`), `locale` (options = `SUPPORTED_LOCALES`, shown for `locale`). Output: one item per entry `{ key, name, locale }`. `locale` mode needs no login.

- [ ] **Step 1:** Add test in `test/translation.test.ts` only if new pure code appears; otherwise none (wiring only).
- [ ] **Step 2:** Implement, build + lint → 0.
- [ ] **Step 3:** Commit `feat: Catalog resource`.

### Task 8: Docs, release readiness, live test

**Files:**
- Modify: `README.md`, `CHANGELOG.md`, `package.json` (version `0.1.0`)

- [ ] **Step 1:** README: what it does, install (community nodes), credential setup, each operation with a short example (incl. paprika-style "By Name: Maison" + translate), translation behaviour (exact/case-insensitive, no fuzzy, unknown → custom item), Remove/Complete without UUID targets newest match, **Credits** (TypeScript port of miaucl/bring-api, link), disclaimer verbatim, license.
- [ ] **Step 2:** `npm run lint && npm run build && npm test` → all 0. `npm pack --dry-run` lists `dist/nodes/Bring/locales/*.json` and no `test/`.
- [ ] **Step 3:** Live test: `docker run --rm -p 5678:5678 -v "$PWD/dist":/home/node/.n8n/custom/n8n-nodes-getbring/dist -v "$PWD/package.json":/home/node/.n8n/custom/n8n-nodes-getbring/package.json n8nio/n8n` (or `npm run dev`, which the CLI provides). With Fred's credential on a test list: Add "Oignons" + "Test n8n" → in the app "Oignons" has an icon, "Test n8n" is custom; Get Items returns both with `name` in French; Remove both by returned UUID → gone. Fred runs the credential step; never paste the password in chat.
- [ ] **Step 4:** Commit `docs: README, credits and changelog`.
- [ ] **Step 5:** Publishing (GitHub repo, npm provenance via `publish.yml`, n8n verification request) is outward-facing: stop and ask Fred before each.
