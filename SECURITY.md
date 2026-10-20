# Security policy

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Report it privately through GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on this repository, if that is enabled. If it is not, open a regular issue
that contains **only** a description of the problem and a request for a
private channel — no exploit details, no payloads, no proof-of-concept code.

Please include:

- what an attacker can do;
- the exact request or configuration that triggers it;
- which version or commit you tested;
- what you expected instead.

You will get an acknowledgement within a few days. Fixes for confirmed
vulnerabilities are released with a note in the changelog. We are happy to
credit you, with the name you want, in the release note and the ADR.

## What this project already defends

These are implemented and tested. If you find a way around one of them, that
is a vulnerability and we want to know.

| Boundary                                                             | Where it lives                                    |
| -------------------------------------------------------------------- | ------------------------------------------------- |
| The API server never runs an agent — the worker does                 | `apps/server` never imports an adapter            |
| Credentials are encrypted at rest and never returned by the API      | `apps/server/src/lib/crypto.ts`, `secret_configs` |
| Agent tokens are scoped per connection to an explicit tool grant     | `apps/server/src/modules/mcp/server.ts`           |
| Only an explicit acceptance closes a factory task                    | `POST /api/tasks/:id/accept`                      |
| Resource updates carry the revision they were based on               | `expectedRevision` on every update                |
| Outbound requests cannot reach private or loopback addresses         | the outbound request guard                        |
| SQL data sources may only read an allowlist of tables                | the SQL table allowlist                           |
| The CLI adapter runs with a sanitised environment and a hard timeout | `packages/agent-adapters/src/cli.ts`              |

## Known limitations

These are real, documented, and not fixed. Treat them as part of the threat
model rather than as bugs.

- **The CLI adapter is supervised, not sandboxed.** It drops the server's
  environment, confines the working directory and caps runtime, but it is
  still a normal process on your machine. The isolation boundary is the
  container: run the worker with a read-only root filesystem, no host mounts
  beyond the agent's own directory, and no access to the Personal OS secret
  key.
- **Personal OS is single-owner.** There is one owner account. Anyone who can
  reach the server as the owner can read and change everything, including
  agent credentials. Do not expose it to an untrusted network.
- **An approval closes its execution; it does not resume it.** Deciding an
  approval finishes the blocked execution with that outcome. It does not
  re-enter the adapter and continue the interrupted turn.
- **Agent autonomy is bounded, not absent.** An autonomous agent can act
  within its policy, which is enforced server-side. Keep the policy tight and
  keep the approval list populated.
- **The event stream replays recent events on every connect.** A client that
  connects to the stream can read recent activity. That is by design — it is
  how the control panel stays in sync — but it means the stream is as
  sensitive as the activity it carries.

## Deploying it

The container images are built from the same source as the repository. If you
run Personal OS on a network other than your own:

- do not expose it directly to the internet without a reverse proxy that
  terminates TLS and authenticates;
- keep the data directory on a local filesystem, not a network share, because
  SQLite needs working file locking;
- keep `PERSONAL_OS_OWNER_TOKEN` out of shell history and CI logs;
- treat the SQLite database and `secret.key` as one secret: whoever has the
  key can decrypt every stored credential.
