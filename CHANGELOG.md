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
  automation. The route splitting is covered too — every lazy route renders,
  the first paint fetches no page, and a chunk that fails to load shows an
  error state instead of a blank screen. `npm run test:e2e` runs all 15.
- **A test layer for the web client.** 44 unit and component tests cover the
  API client's error handling, the event stream's replay and schema
  validation, the status badge, the vendor-chunk map, and the bundle budget
  rules.
- **An open-source project surface.** MIT licence, contribution guide, code of
  conduct, security policy, issue and pull-request templates, editor config,
  Dependabot and CodeQL.
- **CI that runs the product.** The pipeline builds, typechecks, tests,
  formats, runs the end-to-end smoke test, boots the compiled server, runs
  the browser suite, audits the dependency tree, and starts the container
  stack to prove the shipped image serves the client.
- **A bundle budget the build enforces.** Vite only warns when a chunk is too
  large, and it still exits zero, so the rules are enforced by a script that
  fails the build: no chunk may exceed 300 kB, every declared vendor chunk
  must actually be emitted, and the first paint may not carry a page chunk.
  `npm run verify:bundle` runs it, and CI runs it on every pull request.
- **A check that a running deployment actually works.** `npm run
verify:stack` signs in, registers an agent, posts a message to it and waits
  for the worker's reply. A health check says the server answers; this says
  the worker is alive and executing. CI runs it against the container stack.
- **A lint for the workflow definitions.** actionlint checks that every
  workflow parses, that every action input exists, and that every shell
  snippet is sound. It runs in CI, so a broken workflow is caught on the
  pull request that breaks it rather than the push after.

### Changed

- **The web client loads one route at a time.** The control panel used to
  ship as a single 584 kB JavaScript chunk, because every page component was
  imported eagerly — the browser downloaded the agents page, the factory
  board and the settings screen before the login screen could paint. Each
  route is now its own chunk and the heavy vendor libraries are split out, so
  the largest emitted chunk is 186 kB and the first paint is 497 kB across six
  chunks — about 15% smaller than the 584 kB it used to download in one
  piece. The entry chunk on its own is 154 kB, a quarter of the old one, but
  the browser preloads the vendor chunks too, so the honest figure is the
  sum and not the entry. The build now carries a chunk-size limit, so a
  change that quietly re-bundles the panel into one file fails the build
  instead of the user.
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

- **A page that fails to load no longer blanks the control panel.** Splitting
  the client into one chunk per route introduced a failure that did not exist
  when the whole panel shipped as one file: the browser can fail to download
  a page's code — a deploy renames the file, a request is dropped — and the
  failure tore down the entire application, leaving the owner with an empty
  page and no way out. Each route now sits behind its own error boundary, so
  the panel and its navigation survive the failure and the page shows an
  error state with a retry. A retry that fails a second time reloads the
  panel, because the browser keeps a failed module in its cache and no
  further request for it could ever succeed.
- **A portable Compose verification.** `scripts/verify-compose.ps1` resolved
  the repository from an absolute path that only existed on one machine. It
  now resolves from its own location, so it runs in any checkout.
- **The CodeQL workflow now runs at all.** It passed `language` to the CodeQL
  action, whose input is `languages`; the action rejects an input it does not
  know, so the workflow would have failed the first time anybody pushed. The
  build step it carried was also a no-op — CodeQL reads JavaScript and
  TypeScript from the source — and has been removed.

### Security

- The dependency tree now audits clean: `npm audit` reports 0 vulnerabilities.
  The critical `tinypool` remote-code-execution advisory and the
  `braces` stack-exhaustion advisory are both resolved.

[Unreleased]: https://github.com/OWNER/personal-os/compare/v0.1.0...HEAD
