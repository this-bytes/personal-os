# SPEC-SOURCE-HOSTING — simple development hosting

**State:** implemented; local gates passed, CI and host verification recorded in the delivery.

The owner hosts the source checkout without Docker. A systemd user service
supervises API, worker and Vite; a timer fast-forwards clean main from origin.
Updates drain before changing files, install changed dependencies and restart.
Data and the encryption key live outside the checkout. Dirty or diverged main
is refused rather than reset. No API or resource contracts change.

CI runs `npm run verify:source` in a disposable source checkout with its own
dependencies, disposable data and free ports, checking
UI serving, a real worker turn, source reload, persistence across restart,
dependency installation after a manifest change, and safe updater behavior.
Existing typecheck, tests, format, build and smoke gates continue to apply.

Out of scope: zero-downtime updates, Windows firewall automation, container
hosting, runtime restart reconciliation and automatic deletion of old data.

Local evidence: isolated `npm ci`, dependency verification, typecheck, full unit
suite, build, formatting, smoke, bundle budget, source-stack integration and
updater/systemd-unit validation passed. The source CI job also runs on a clean
checkout without prebuilt workspaces. Windows LAN forwarding still requires
administrator networking configuration; it is not created by the installer.
