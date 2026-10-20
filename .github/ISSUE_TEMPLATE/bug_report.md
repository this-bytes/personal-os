name: Bug report
description: Something in Personal OS does not behave the way it should.
title: "bug: "
labels: ["bug", "needs triage"]
body:

- type: markdown
  attributes:
  value: |
  Thank you for filing a bug. Please do not report security issues here —
  see [SECURITY.md](https://github.com/OWNER/personal-os/blob/main/SECURITY.md).

- type: textarea
  id: what-happened
  attributes:
  label: What happened
  description: What did you observe, and what did you expect instead?
  placeholder: |
  I expected the stale resource update to be rejected with 409, but it
  returned 200 and overwrote the newer version.
  validations:
  required: true

- type: textarea
  id: reproduce
  attributes:
  label: How to reproduce
  description: The exact steps, request or configuration that triggers it.
  placeholder: | 1. Create a resource 2. Update it once, so the revision is 2 3. Update it again with expectedRevision 1
  validations:
  required: true

- type: input
  id: version
  attributes:
  label: Version or commit
  description: The commit SHA, release tag, or `npm run build` output you tested.
  placeholder: "abc1234"
  validations:
  required: true

- type: dropdown
  id: surface
  attributes:
  label: Which surface
  multiple: true
  options: - API server - Worker - Web client - MCP endpoint - Agent adapter - Docker / Compose - Documentation - Other
  validations:
  required: true

- type: textarea
  id: output
  attributes:
  label: Relevant output
  description: >
  Failing gate output, logs, or the API response. Actual output is far
  more useful than a description of it.
  render: text
  validations:
  required: false
