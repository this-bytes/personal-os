name: Feature request
description: Something Personal OS should be able to do.
title: "feat: "
labels: ["enhancement", "needs triage"]
body:

- type: markdown
  attributes:
  value: |
  Before you open this, check [PRODUCT.md](https://github.com/OWNER/personal-os/blob/main/PRODUCT.md).
  It says what this product owns and what it deliberately does not. A
  request that contradicts it is a product decision, not a bug — say so
  in the issue and it will be discussed as one.

- type: textarea
  id: problem
  attributes:
  label: The problem
  description: What are you trying to do that you cannot do today?
  placeholder: |
  I cannot tell whether an automation actually ran, only that it was
  created. When one fails there is no way to see what it did.
  validations:
  required: true

- type: textarea
  id: proposal
  attributes:
  label: What you would like to happen
  description: A sketch is fine. You do not need to specify the implementation.
  placeholder: |
  The automations list shows the last run, its status and the error when
  it failed.
  validations:
  required: true

- type: textarea
  id: alternatives
  attributes:
  label: Alternatives you considered
  description: Including "do nothing" if that is genuinely enough.
  validations:
  required: false

- type: textarea
  id: boundaries
  attributes:
  label: Scope
  description: >
  What should this deliberately NOT do? This is the section that stops
  scope creep, and it is not optional.
  validations:
  required: true

- type: checkboxes
  id: contract
  attributes:
  label: Contract impact
  options: - label: This changes a published contract, schema or route.
  required: false - label: This adds a new agent adapter or resource type.
  required: false - label: This adds a new dependency.
  required: false
