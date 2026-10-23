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
  error state instead of a blank screen. The waiting list is covered as well:
  an empty panel says so plainly, an entry says what it is and leads to where
  it is decided, and an item that stops waiting disappears without the owner
  reloading. `npm run test:e2e` runs all 18.
- **A test layer for the web client.** 46 unit and component tests cover the
  API client's error handling, the event stream's replay and schema
  validation, the status badge, the vendor-chunk map, and the bundle budget
  rules.
- **One list of everything waiting on you.** The panel opens on a "Waiting on
  you" list: an agent stopped on an approval, a task waiting for your
  acceptance and a task that is blocked are one question asked in three
  places, and the answer is now in one place. Each entry says what it is and
  links to where it is decided. The server assembles the list in a single
  request — `GET /api/waiting` — so the browser does not have to fetch three
  and join the answers itself, and a thing that is both a task and an approval
  appears once, not twice.
- **An open-source project surface.** MIT licence, contribution guide, code of
  conduct, security policy, issue and pull-request templates, editor config,
  Dependabot and CodeQL.
- **CI that runs the product.** The pipeline builds, typechecks, tests,
  formats, runs the end-to-end smoke test, boots the compiled server, runs
  the browser suite, audits the dependency tree, and starts the container
  stack to prove the shipped image serves the client.
- **A bundle budget that is enforced.** Vite only warns when a chunk is too
  large, and it still exits zero, so the rules are enforced by a gate that
  fails: no chunk may exceed 300 kB, every declared vendor chunk must
  actually be emitted, the first paint may not carry a page chunk, and the
  first paint must stay below the 584 kB the single-bundle client used to
  download. `npm run verify:bundle` runs it, and CI runs it on every pull
  request.
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
  the largest emitted chunk is 186 kB and the first paint is 498 kB across six
  chunks — about 15% smaller than the 584 kB it used to download in one
  piece. The entry chunk on its own is 154 kB, about a quarter of the old one,
  but the browser preloads the vendor chunks too, so the honest figure is the
  sum and not the entry. The build warns above 300 kB and
  `npm run verify:bundle` fails, so a change that quietly re-bundles the panel
  into one file is caught on the pull request that does it.
- **Tailwind CSS 4.3.** The 3.x dependency chain pulled in `chokidar` →
  `braces` → `micromatch` → `fast-glob`, and `braces` has no patched release
  at any version, so the chain had to go. The palette and the monospace
  family now live in a `@theme` block in `apps/web/src/index.css`, the shared
  UI package is scanned through an explicit `@source` because the automatic
  detection only covers the app's own tree, and the v3 `darkMode: 'class'`
  behaviour is kept by an explicit `@custom-variant dark`.
- **Vitest 4.1.** The 3.x line depends on `tinypool`, which carries a
  prototype-pollution gadget that leads to remote code execution.
- **Node.js 22.13 or newer**, the floor the test tooling needs.
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
  now resolves from its own location, so it runs in any checkout. It also
  checks what the documentation always said it checked: the worker in the
  stack executes the product's core loop, and a page that is not the web
  client fails the run instead of printing a warning.
- **The CodeQL workflow now runs at all.** It passed `language` to the CodeQL
  action, whose input is `languages`; the action rejects an input it does not
  know, so the workflow would have failed the first time anybody pushed. The
  build step it carried was also a no-op — CodeQL reads JavaScript and
  TypeScript from the source — and has been removed.

### Security

- The dependency tree audits clean: `npm audit` reports 0 vulnerabilities.
  The critical `tinypool` remote-code-execution advisory and the `braces`
  stack-exhaustion advisory are not in the tree — the packages that carried
  them are not dependencies of this project.
- The `zod` memory-exhaustion advisory (GHSA-mrhx-c7xc-m3w5) is out of the
  tree. npm widened its range to `zod < 4.6.6` on 2026-10-23, which named the
  pinned 3.25.76 and failed the audit on every branch, `main` included. The
  tree now holds 4.6.7, whose v4 code carries upstream's size-bound fix, and
  the schemas still use zod's v3 API through the `zod/v3` subpath, so the
  published contract is unchanged. The reasoning is in
  [ADR 0014](docs/decisions/0014-the-contract-schemas-stay-on-zods-v3-api.md).

[Unreleased]: https://github.com/this-bytes/personal-os/compare/main...HEAD
