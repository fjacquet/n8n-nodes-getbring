# Changelog

## Unreleased

### Changed

- README documents n8n 3.0: the node works unchanged (checked against the 3.0.1 release candidate), but n8n 3.0 disables unverified community packages by default, so `N8N_UNVERIFIED_PACKAGES_ENABLED=true` must be set on the n8n container.

## 0.1.2 — 2026-10-26

### Changed

- Dependency refresh for open security advisories (dev dependencies only; no runtime change). eslint 10 and TypeScript 7 stay deferred: `@n8n/node-cli` does not support them yet.

## 0.1.1 — 2026-10-24

### Fixed

- First release published from GitHub Actions with npm provenance (public access, Trusted Publishing). Same code as 0.1.0.

## 0.1.0 — 2026-10-24

### Added

- Bring! node with resources List (Get Many, Get Items), Item (Add, Remove, Complete) and Catalog (Get).
- Credential `Bring API` (email and password) with a login test.
- Item names are translated to Bring catalog keys for the 20 supported locales (exact, case-insensitive, then German-key match; unknown names become custom items).
- Batched item writes: one request per list.
- Remove and Complete without an Item UUID act on the newest match.
- List picker by search, UUID or exact name.
- Usable as a tool by AI Agent nodes.
