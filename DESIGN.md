# AI Infra Space — DESIGN.md

## Intent and provenance

An engineering knowledge workspace: precise, calm, legible, with tools that feel like one product rather than separate demos. Adapted from VoltAgent awesome-design-md at f6961238d5cddcf8042a74a70fc400ec67181abb: Linear supplies the dark surface hierarchy and restrained lavender accent; Mintlify supplies documentation density and navigation. The pinned references and MIT license live in .agents/skills/awesome-design-md/.

This document takes precedence over conflicting reference styling. We do not copy either brand identity, proprietary fonts, screenshots or product claims. Existing scientific/semantic chart colors are retained.

## Tokens

- Canvas #0b0c0e; surface #121316; raised #1a1b20; input #101114.
- Border #2a2c33; strong border #464953.
- Main text #f4f4f5; secondary #b5b7c2; muted #9497a5. Muted text must remain readable, not low-opacity decoration.
- Accent #a9a3ff for links, active states and focus. Solid primary button #6557c8 with white text. Hover #7768df.
- Positive #8bd5b2; warning #e9c17b; danger #f29da5. Never encode state by color alone.
- Use CSS variables and Tailwind semantic colors: canvas, surface, raised, field, line, ink, secondary, muted, accent, action.
- Radius: 8px controls; 12px cards; 16px large feature panels. Pills reserved for tags/status, not every action.
- Spacing: 4px base. Controls 8–12px; panel padding 20–24px; section gaps 32–48px; landing major bands 64–80px.
- System sans: Inter if installed, -apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans SC, PingFang SC, sans-serif. Use system mono only for code, IDs, shapes and quantitative values. No required external font requests.

## Shared structure

64px fixed main navigation. Consistent brand, active route and language action. A keyboard-visible skip link targets the main content. Mobile menu has expanded state, Escape dismissal and returns focus. Main containers max 1440px with 20/32/48px gutters; reading column max 760px. Route navigation scrolls to top only when pathname changes, never when calculator query parameters change or in-article anchors are used.

One clear H1 per page. Page headings: 32–44px desktop, 28–32px mobile, weight 600, modest negative tracking; landing 48–72px. Body 16px / 1.7 for prose; tools 13–14px / 1.5. Technical metadata can be 12px, not tiny critical labels. Distinguish eyebrow, title, short description and controls.

Cards use a solid surface and a one-pixel border; little or no shadow. No ambient neon glows, animated grids, decorative orbits or gradients behind dense tools. Selected states combine border/background with text or aria state. Hover does not cause large layout movement.

## Page families

- Home: concise editorial hero with two clear entry actions; four extensible module cards driven by module data; a compact practical starting-points section. Show real capabilities, not made-up live metrics.
- Learning: searchable course hub, numbered learning routes, subject catalog, SGLang reading room and newest content. Keep all bilingual metadata and all category links.
- Category: stable topic navigation and clear selected topic; mobile topic controls visible. Articles as compact readable cards.
- Article: source/breadcrumb, title/meta, readable prose, code/table wrappers and persistent desktop TOC. Mobile TOC must collapse without hiding the article. Retain lazy body loading, language fallback, anchors, previous/next links and retry.
- Knowledge graph: explain interactions, keep the wide graph in a named horizontal-scroll region, and preserve module selection, relationship highlighting and details. Add keyboard and select-menu access without changing the architecture; diagram colors encode meaning, not brand decoration.
- Model knowledge/catalog: distinguish conceptual navigation from model lookup; compact filter shelf and scannable cards; preserve learning paths, favorites/selection and URL state.
- Model details and DPA/V4.1: compact heading and segmented workspace navigation; parameter controls grouped by task, important computed results visually prominent; preserve all diagrams, ownership, precision, PP/EP/TP/DP, caches, layer/rank selection and warnings.
- Compare: selections then shared conditions then results; differences remain inspectable; never replace data with static mockups.
- Profiling/estimator: primary workflow separated from optional advanced settings, local-data privacy visible, calculations and errors preserved, phase charts and all A/B views usable.
- News: editorial hierarchy with clear daily/weekly/release/reading-list navigation, compact filters, source/status transparency, readable reports. Preserve categories, countries, search, archive, bookmarks, import/export and local preferences.
- About, loading, empty and not-found: same typography/surfaces, useful next navigation; no dead-end page.

## Controls and accessibility

Visible focus outline on every interactive element, 2px accent with offset. Input labels stay visible; errors associate with the field where practical. Disabled/selected states must be discernible. Mobile controls target 44px. Tables with many columns have a named horizontal-scroll region, never squeezed to vertical characters. Dialogs retain native focus/escape behavior. Motion respects prefers-reduced-motion.

Do not recolor all SVGs globally. Do not override hidden attributes or dialog display. Do not replace functional controls with decorative versions. Sticky regions must not obscure editing or consume the whole mobile viewport.

## Acceptance

The full route/state matrix is in docs/design-refactor.md. Validate actual rendered routes at 360, 390, 768 and 1440px, including filter and error states. Check relevant existing unit/render/browser tests; inspect screenshots of each page family. Keep URLs and storage contracts intact. Verify deployed assets and live flows after authorized publication. A passing route smoke test is not a substitute for calculator, news and profiling interaction regressions.
