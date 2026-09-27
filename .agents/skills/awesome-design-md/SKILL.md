---
name: awesome-design-md
description: Apply the project's Awesome DESIGN.md design system when building or refactoring AI Infra Space pages, navigation, documentation readers, model tools, profiling, or news UI. Preserve existing calculations, content, routes, and privacy behavior.
---

# Awesome DESIGN.md — AI Infra Space

This project-local skill adapts VoltAgent's design documentation collection; upstream is not itself a Codex skill. It does not install global tools.

## Use

1. Read the project's [DESIGN.md](../../../DESIGN.md) completely before UI changes. This is the implementation contract, resolving differences between the two reference systems.
2. For shell, landing, tool or dashboard changes, read [Linear](references/linear.md). For course reader, documentation navigation or long-form news report changes, also read [Mintlify](references/mintlify.md). These are pinned upstream references, not instructions to imitate brand assets, proprietary fonts, screenshots or marketing claims.
3. Inventory affected routes and states. Refactor shared visual primitives first, then page-specific information hierarchy. Keep domain code, formulae, sources and existing state contracts intact unless the user requests otherwise.
4. Verify keyboard navigation, readable contrast, mobile overflow, URL/back/refresh behavior, error/loading/empty states and real interactions. A screenshot or a passing build alone does not prove functionality.
5. Run the relevant existing tests and update the route acceptance matrix in docs/design-refactor.md. For a whole-site request, all route families and their tools remain in scope.

Use semantic surface/text/border/accent tokens. Meaningful colors in architecture diagrams, charts, warnings and statuses may differ from the UI accent; do not erase data semantics to enforce a monochrome palette. Keep tables scrollable without shrinking labels, and keep sticky results usable on small screens.

Do not import remote executables, user data, paid/proprietary assets or secrets. Keep profiling local and preserve the existing news/reading-list privacy contracts. Follow the user's deployment authorization; this skill does not authorize deployment itself.

## Provenance

Upstream: https://github.com/voltagent/awesome-design-md
Pinned revision: f6961238d5cddcf8042a74a70fc400ec67181abb
References: design-md/linear.app/DESIGN.md and design-md/mintlify/DESIGN.md.
License: MIT, preserved in LICENSE.
