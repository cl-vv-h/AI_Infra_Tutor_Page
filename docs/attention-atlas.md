# Attention evolution atlas

`#/learn/attention` is a teaching module linked from `/learn`, not a new top-level
home module. Catalog/relation/query definition: `attention-atlas/1`, reviewed
2026-10-10. No model math, cache estimates, news datasets or storage formats change.

## Editorial and interaction contract

- 32 representative techniques across six routes. The scope is language-model
  inference, not an exhaustive census of attention literature. SSM and hybrid
  architecture nodes are explicitly identified. Self/cross, causal/bidirectional
  and positional encoding are orthogonal dimensions, not invented generations.
- Every node has a primary paper/report, short explanation and limits. Existing
  tutorials are reused where available; otherwise the original paper is the deep
  reading destination. Years refer to the cited work's first publication; SWA is
  the year of the cited representative implementation, not an invention claim.
- Four edge semantics: extension/generalization, related design (not inheritance),
  hybrid adoption, execution optimization. Every edge has its own explanation and
  source. Never infer inheritance merely from publication order. In particular,
  MLA → DSA and DeltaNet → GDN → KDA are extensions; NSA is not DSA;
  MLA + KDA → Kimi Linear is hybrid adoption, not MLA → KDA.
- Main-path overview, complete graph, six branch views, bounded search and direct
  selection. All catalog names are also available in the collapsible index.
  Only names/years appear in graph nodes. Hover/focus gives an interactive preview;
  selection pins the description with lesson/paper links above the graph. Touch
  uses selection; Escape dismisses preview. There is no automatic motion.
- URL carries public view/node/query only. Browser back and refresh restore them;
  unknown/duplicate/oversized values show a resettable warning. Nothing is written
  to browser storage or uploaded. Graph has a named horizontal-scroll region;
  direct selection is the narrow-screen alternative. Cross-family relationships
  are fully readable as evidence cards even when not drawn in a branch view.
- Lazy-load failure has a retry and a teaching-directory escape route.

## Extending the map

Edit `src/data/attention-atlas.ts`. Add a stable ID, category, year, summary, limit,
primary source and optional valid lesson slug. Add only defensible relations;
`alternative` is a pedagogical comparison, not a claim of historical influence.
Update overview positioning only if the small representative backbone changes.
Run `tests/attention-atlas.test.mjs` and `tests/attention-atlas-browser.mjs`.
The browser suite is included in the Pages smoke gate.

## Standalone main-route diagram

The optional `public/diagrams/attention-core.html` is generated from
`docs/diagrams/attention-core.json` using Archify 2.17, architecture/showcase. It
contains only three representative routes, not the complete interactive catalog.
Keep the source as the editable artifact; never patch generated SVG/HTML geometry.
Visual evidence and screenshots are local QA files, not published assets.

Artifact receipt for the frozen candidate:

```text
diagram_type: architecture
output: public/diagrams/attention-core.html
specification_sha256: b04bc86711b9a16c7afdb95c5da34953ade0594222e07e8bd1f5661cb0ae215e
artifact_sha256: dbe28605facdca2e54a7a9fcb72d45e8b011e5cc1e7373df8f15337f80ed0436
validation: 9/9 showcase, 0 errors, 0 warnings
browser_evidence: passed
visual_review: passed
correction_rounds: 1
```

Automated containment: 1440×900, 1600×1000, 1920×1080 and 2048×1320; endpoint
light/dark screenshots. Perceptual inspection included 1440 dark and 2048 light.
The initial artifact overflowed vertically; reducing unnecessary row spacing
fixed it without shrinking nodes, hiding content or adding desktop scrolling.

## Disable and withdraw

`config/attention-atlas.json` is the independent build-time release gate. Set
`enabled: false`, rebuild and publish to remove the entry/route; it is not a remote
live kill switch. No storage cleanup is performed. The standalone diagram is a
public educational file, not an executable application route; gate-off does not
delete this artifact. A full targeted revert removes it as well.

See `releases/attention-atlas-2026-10-10.md` for the actual feature SHA, verification,
rehearsal and exact withdrawal. Never reset or force-push the repository to undo
this module, and retain any intervening news/user work.
