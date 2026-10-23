# SPEC-SOURCE-HOSTING — simple development hosting

**State:** implemented, validation in progress.

The owner hosts the source checkout without Docker. A systemd user service
supervises API, worker and Vite; a timer fast-forwards clean main from origin.
Updates drain before changing files, install changed dependencies and restart.
Data and the encryption key live outside the checkout. Dirty or diverged main
is refused rather than reset. No API or resource contracts change.

CI runs `npm run verify:source` with disposable data and free ports, checking
UI serving, a real worker turn, source reload, persistence across restart,
dependency installation after a manifest change, and safe updater behavior.
Existing typecheck, tests, format, build and smoke gates continue to apply.

Out of scope: zero-downtime updates, Windows firewall automation, container
hosting, runtime restart reconciliation and automatic deletion of old data.
