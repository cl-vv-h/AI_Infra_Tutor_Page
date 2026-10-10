# Attention evolution atlas — 2026-10-10

## Scope and revision

- Remote baseline: `87f825580822674b170dfc2ab57f0618ad484f1e`.
- Feature commit: `46c774b9623fb9d64ba7dea6972f06c2c111cdd7`.
- Touch-reading correction: `618b26a4f60ff0a5f8dc0c97071828ab8bc54b12`.
  On narrow/coarse-pointer screens, selecting a node focuses and reveals its
  summary. A bottom-of-full-graph touch regression checks the reading link is
  actually in the viewport, not merely present in the DOM.
- Catalog, relation and query definition: `attention-atlas/1`. Existing model,
  cache, parallelism and news calculations remain unchanged.
- New teaching-directory entry and `#/learn/attention`; 32 sourced representative
  techniques, six branches, explicit relation semantics, hover/focus previews,
  touch selection, lesson/paper links, search and URL-restorable views.
- Independent build-time gate: `config/attention-atlas.json`. Disable and rebuild
  to remove the entry/route. This is not an instantaneous remote switch. The
  standalone public main-route diagram remains addressable until a full revert.
- No new application storage, migration, credentials, news content or scheduled
  tasks. The optional Archify viewer reuses its existing theme/motion preference
  keys only on viewer controls; no browsing/selection history is persisted.

## Verification

- 414 unit tests, including catalog/source/lesson integrity, core relation
  semantics, extension acyclicity, bounded URL state, search and overview parity.
- TypeScript, ESLint and production build passed. The existing large news-chunk
  advisory remains; no warning threshold or test gate was relaxed.
- All 11 critical browser suites passed, including existing engineering tools,
  weekly news, event tracking, hotspots, PULSE and the new atlas. After the final
  search-state and token-style refinement, the atlas suite was rerun successfully.
- Atlas checks at 360/390/768/1440px: keyboard focus/Escape/Enter, hover-to-link,
  touch, selection, all six branches, search/empty recovery, fast filter/clear,
  URLs/back/refresh, original lesson navigation, no document overflow, no storage
  writes or external requests and lazy-chunk failure/reload recovery.
- Whole-site design regression: 212 checks passed; reader loading/failure/retry,
  adjacent navigation, clipboard denial/success and archive recovery passed.
- Native desktop/mobile screenshots were inspected. The optional Archify artifact
  passed 9/9 showcase checks, zero composition errors/warnings, four desktop
  viewport containment checks and perceptual review. Exact hashes and the one
  spacing correction are recorded in `../attention-atlas.md`.
- The fetched baseline's latest Pages run had failed at an existing news-follow
  reload assertion while still loading. That check remained enabled and passed
  locally; this feature does not claim to fix all intermittent news load failures.

## Isolated rollback rehearsal

From the final runtime revision, a synthetic intervening news file was committed in a
temporary managed checkout. One fresh browser context remained alive across:

1. Feature enabled, real local topic follow plus localStorage/IndexedDB canaries.
2. Gate disabled and rebuilt: original teaching directory remains, atlas absent.
3. Gate restored in source, touch correction then base feature reverted and
   rebuilt: original routes remain; all new feature files are withdrawn.
4. Revert of those withdrawals in reverse order and rebuild: atlas and its KDA
   deep link return.

Each phase checked the original teaching directory, MLA article, model directory,
weekly news and the real followed topic. All localStorage entries and the
independent IndexedDB record remained unchanged. Intervening news tree was
`e482e2547d0f01bcb5e4033c6817742303713e9c` throughout. After reapplication, the only
difference from the final runtime revision was the synthetic news file. None of these
synthetic commits or records are part of the published branch.

## Exact production withdrawal

Fetch current main and use a clean isolated checkout from it, not the user's
development directory. Withdraw the dependent touch correction before the base
feature. Keep this audit record:

```sh
git revert 618b26a4f60ff0a5f8dc0c97071828ab8bc54b12
git revert 46c774b9623fb9d64ba7dea6972f06c2c111cdd7
npm run check
npm run lint
npm run test:unit
npm run news:events:check
npm run news:weekly:library
npm run build
npm run test:smoke
```

Stop on a revert conflict and retain the conflict state. Do not reset, restore
the whole tree, delete browser data or force-push. Preserve intervening news and
user changes. Push the new revert commit normally after verification, then check
its Pages result and original teaching/news routes. To re-enable after a full
withdrawal, revert the actual base-feature withdrawal first, then the actual
touch-correction withdrawal; do not restore an old snapshot.

## Publication boundary and next step

Local checks and SSH push alone do not establish publication. The delivery must
also confirm a successful Pages workflow for the pushed release tip and exercise
the public teaching entry, diagram, links, selection and refresh. The delivery
response records that external outcome. No Luna report was produced here.

Next: expand the evidence-backed catalog when justified by learning needs; keep
representative coverage distinct from an exhaustive literature survey. Preserve
edge semantics and never infer dependency from chronology alone.
