# Changelog

All notable changes to Personal OS are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [semantic versioning](https://semver.org/spec/v2.0.0.html).

Entries describe what a user can now do, not which commits landed.

## [Unreleased]

### Added

- **The software factory.** Personal OS is now built by a team of agents with
  separate mandates — a factory lead, an implementation engineer, a
  verification engineer and a contracts and documentation engineer —
  coordinated by a work-item loop that every change passes through. The
  doctrine lives in the repository in [FACTORY.md](FACTORY.md) and
  [`.factory/`](.factory/), so every agent reads the same rules from the same
  version-controlled place.
- **A browser test suite.** Playwright drives the built client in headless
  Chromium: the owner creates the account, narrows an agent's MCP tool grants
  and confirms the server stored them, and builds an event-triggered
  automation. `npm run test:e2e` runs it.
- **A test layer for the web client.** 28 unit and component tests cover the
  API client's error handling, the event stream's replay and schema
  validation, and the status badge.
- **An open-source project surface.** MIT licence, contribution guide, code of
  conduct, security policy, issue and pull-request templates, editor config,
  Dependabot and CodeQL.
- **CI that runs the product.** The pipeline builds, typechecks, tests,
  formats, runs the end-to-end smoke test, boots the compiled server, runs
  the browser suite, audits the dependency tree, and starts the container
  stack to prove the shipped image serves the client.

### Changed

- **Tailwind CSS 3.4 → 4.3.** The v3 dependency chain pulled in
  `chokidar` → `braces` → `micromatch` → `fast-glob`; `braces` has no patched
  release at any version, so the only way to clear the advisory was to
  migrate. The palette and the monospace family moved from
  `tailwind.config.js` into a `@theme` block, and the shared UI package is
  now scanned through an explicit `@source`.
- **Vitest 3.2 → 4.1.** The older line depends on `tinypool`, which has a
  prototype-pollution gadget that leads to remote code execution.
- **Node.js 22.12 → 22.13**, the floor the test tooling now needs.
- **The development contract.** `AGENTS.md` now points at `FACTORY.md`,
  requires the formatter to be run before committing, and lists the
  formatting gate alongside the others.

### Fixed

- **A portable Compose verification.** `scripts/verify-compose.ps1` resolved
  the repository from an absolute path that only existed on one machine. It
  now resolves from its own location, so it runs in any checkout.

### Security

- The dependency tree now audits clean: `npm audit` reports 0 vulnerabilities.
  The critical `tinypool` remote-code-execution advisory and the
  `braces` stack-exhaustion advisory are both resolved.

[Unreleased]: https://github.com/OWNER/personal-os/compare/v0.1.0...HEAD
