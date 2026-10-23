# PULSE relationship semantics — 2026-10-23

## Scope and revisions

- Remote baseline: `7dc4921ddc23c0994cad7ef8e564dae1318899d5`.
- Visual correction: `88f64ad274d18c27fe18b8987490598736c3559a`.
- Independent publication-blocker fix: `e94598b8ec0e3e5aeffa3368c739d3529edc3cfb`.
- Independent distribution fix: `97be5b85f1399609a70bf78e896fe857ccf3d4a3`.
- Visual definition: `news-sphere-semantics/1`; query remains `news-sphere/1`,
  scoring/clustering remains `news-hotspots/1`. Model calculations are unchanged.
- No news/report contents, collection jobs, accounts, credentials, original
  reading-list records or local-follow formats were changed. No storage was added.

All points now use the category palette, explained by a persistent textual
legend. Hover/selection highlights only the active point, not arbitrary category
neighbors. Cross-news lines and preview leader lines are removed. Same-category
reading suggestions remain in the detail list with an explicit non-relationship
label. The corpus has no reviewed cross-signal edges, so this is intentionally
not a semantic graph engine: missing evidence produces no edge.

`config/news-sphere-semantics.json` is an independent build-time switch. Disabling
it removes the visualization but retains PULSE reading and details; it does not
bring back misleading category connections. Rebuild/redeploy is required.

## Independent reliability correction

Baseline Pages run `39904706609` failed before this work at the existing hotspot
loading assertion. The unchanged local smoke suite reproduced that failure.
The seed search previously scanned all earlier headline groups. The new inverted
index only eliminates seeds that cannot share the required three words, then
applies the original predicate in original seed order. Only original seed words
are indexed, never accumulated group words; topic rules retain precedence.

`config/news-hotspot-index.json` independently switches back to the original
linear candidate scan after rebuilding. It changes neither scores nor output
schemas. On the same local 7,615-report corpus, a single 72-hour grouping sample
was 2,652 ms with the old scan and 708 ms with the index; both returned 826 groups.
These are local observations, not device-independent performance guarantees.

Pages run `39912258149` still failed the unchanged follow-after-refresh assertion.
A controlled CPU-throttled reproduction retained the saved record byte-for-byte:
the initial render and subsequent follow-state read were delayed by synchronous
calculations. Distribution had classified each report again for every category
in its daily matrix. A separate single-pass implementation reuses one report
classification for both counts and the matrix, retaining UTC prefix semantics,
all-report counts, category rules and country sorting. Its independent build gate
is `config/news-distribution-pass.json`; disabling it restores the previous scan.
The follow storage, write locking, hooks and tests' deadlines remain unchanged.

## Verification

- 425 unit tests passed. New tests cover distinct category colors, reading-only
  suggestions, exact old/new clustering output parity for all supported windows,
  earliest-seed tie breaking, minimum overlap, category boundaries, non-chaining,
  rule precedence, short/Chinese titles and deterministic varied corpora.
- Distribution parity tests cover all four corpus windows, empty input, UTC
  boundaries, out-of-week totals, source-rule overrides, country ties and input
  preservation. Both optimization switches retain the original algorithms.
- TypeScript, ESLint, production build, event-index consistency, weekly library
  integrity and news rendering passed. No assertion or timeout was relaxed.
- All 12 critical browser suites passed locally, including the previously failing
  hotspot refresh flow and all existing teaching tools, news and Attention routes.
- New four-width checks (360/390/768/1440px) inspect actual Canvas drawing calls:
  zero line segments on preview and selection, category colors, readable legend,
  text-only suggestions, keyboard actions, themes, filters/refresh and privacy.
  Existing PULSE tests retain actual pointer/touch, pause/step/reduced-motion,
  back/refresh, cross-tab follows and canvas/storage/chunk failure coverage.
- The disabled visualization was built and tested at all four widths. Desktop,
  mobile and legend screenshots were inspected. Original main-checkout changes
  were left untouched; the delivery branch contains no news-data diff.

## Isolated withdrawal rehearsal

A managed temporary checkout received a synthetic intervening news commit. One
fresh browser context remained alive across these rebuilt revisions:

1. Visual correction enabled, a real local topic follow and independent
   localStorage/IndexedDB canaries seeded.
2. Visual switch off: no canvas, full news reading retained.
3. Visual commit reverted: previous category/preview lines returned, confirmed
   through actual Canvas calls rather than a status attribute.
4. Visual withdrawal reverted; index fix applied with its switch off: corrected
   zero-edge canvas returned while the original clustering scan remained active.
5. Index commit reverted, then its withdrawal reverted: corrected visuals and
   source reports remained available through both builds.

Every phase retained daily/weekly, followed-topic and Attention routes, the real
follow and byte-identical localStorage plus the independent IndexedDB value.
The intervening news tree stayed `706333d5411409ef0da17acb3b5f0cc5413a241f`.
After reapplication only the synthetic news file differed from the runtime tip;
none of the synthetic data or rehearsal commits are published.

The subsequent distribution fix received a second isolated rehearsal with its
own synthetic intervening news commit. The same browser context traversed the
enabled build, gate-disabled build, targeted revert and reapplication. Each phase
retained the corrected zero-edge visualization, daily/weekly/Attention routes,
the real topic follow and unrelated localStorage/IndexedDB canaries. Its news
tree remained `8209fdd4377533f1ec8e521307bd8115709c12f6`; after reapplication only
the synthetic news canary differed from the runtime tip. No test data was pushed.

## Exact targeted withdrawal

Work in a clean isolated checkout of current remote main. These three runtime
changes can be withdrawn independently. To withdraw all three, reverse their
publication order:

```sh
git revert 97be5b85f1399609a70bf78e896fe857ccf3d4a3
git revert e94598b8ec0e3e5aeffa3368c739d3529edc3cfb
git revert 88f64ad274d18c27fe18b8987490598736c3559a
npm run check
npm run lint
npm run test:unit
npm run news:events:check
npm run news:weekly:library
npm run build
npm run test:smoke
```

Prefer the visualization's build switch for a temporary fallback: a full revert
of the visual correction restores the former category lines. Reverting the index
may also restore the known load-time risk. Keep this audit record. Stop on any
conflict and retain the conflict state; never reset, force-push, restore the whole
repository, delete browser data or discard intervening news. Re-enable by
reverting the actual withdrawal commit(s), in reverse withdrawal order.

## Publication boundary and next step

Only successful Pages for the pushed SHA plus live interaction checks establish
publication; the delivery response records that outcome. No weekly report was
generated here. Future event edges require reviewed endpoint/type/source evidence
and an accessible explanation, not category matches or an arbitrary link quota.
