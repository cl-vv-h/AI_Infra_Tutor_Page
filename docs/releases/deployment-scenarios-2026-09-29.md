# Deployment scenarios — release and rollback record

## Identity and scope

- Development baseline: `c32f86dc748d91cedb13a0e5731c2cbb73a0fa44`.
- Release foundation: `5ac0c6550f6efe6f52653b75147e07f8263d65ba`.
- Transactional scenario library: `470e1a274961a2d0258d7a7ff00d21e54cf31ee3`.
- Scenario comparison: `ea6b1088cbc920b39b1cb7029cca38e64bbace9f`.
- Calculator definition: `1d8824ec5b575bc928f8e68cf7217e9d30587a4300869083d4518f7c2ad0529a`.

The delivery commit also contains this historical record. The deployed revision
is exposed in `release.json`; confirm the matching Pages workflow and public
scenario journeys before treating a push as a successful publication.

Generic model explorer only. Saved state includes per-weight precision, parallel
topology, rank/stage/layer, workload and cache budget. Results are recomputed from
current definitions. PP/Attention DP cache combinations remain explicitly
unsupported. Decoder weights do not include embeddings, LM head, activations,
communication workspace or a claim of full deployment feasibility. Independent
native packing views remain separate. No existing calculation formula changed.

## Verification

- TypeScript, ESLint, production build and 349 unit tests passed.
- News/report integrity, model catalogue/comparison/DPA/V4.1/weights SSR passed.
- Publication browser gate passed: weekly history and recovery, Profiling guide
  and recovery, weight deployment, scenario library and scenario comparison.
- New browser suites passed at 360, 390, 768 and 1440px: save/reload/restore,
  rename/copy/delete confirmation, JSON round-trip/preview, invalid and conflicting
  imports, unknown models, denied storage, failed writes, multi-tab revision
  conflict, comparison difference filter, three-selection limit and URL history.
- Screenshots inspected on mobile and desktop. Wide comparison tables scroll
  within a labelled region rather than causing document overflow.

## Rehearsed rollback

On a separate, never-published branch, add an intervening synthetic news file.
Keep a single isolated browser context on the same preview origin with one saved
synthetic scenario. Run `tests/scenario-retention-browser.mjs` and send the phase
names below on stdin after each rebuild:

1. `comparison-off`: disable only comparison; library stays usable.
2. `library-off`: disable library; comparison is also hidden, data is untouched.
3. Restore the flag file, revert the three feature commits below, then rebuild.
   `reverted` verified the original model route and absence of new controls.
4. Revert those rollback commits in reverse order and rebuild. `restored` verified
   that the original scenario is readable and restores PP=4. End with `done`.

All four phases passed, preserving the exact IndexedDB record, content and
revision. After full rollback, the tree differed from the development baseline
only by the synthetic news file; after restoration it differed from the feature
tree only by that file. No rehearsal commits, fixtures or browser data are part
of this release.

## Production rollback procedure

Work in an isolated checkout based on current main. Inspect later changes first.
For comparison-only rollback, revert the first SHA below. For the entire feature,
use these exact SHAs in this order, not a commit range:

```sh
git revert --no-edit ea6b1088cbc920b39b1cb7029cca38e64bbace9f
git revert --no-edit 470e1a274961a2d0258d7a7ff00d21e54cf31ee3
git revert --no-edit 5ac0c6550f6efe6f52653b75147e07f8263d65ba
```

Stop on any conflict; preserve the checkout and do not force-push. Keep later
news and unrelated commits. Run that revision's type/lint/unit/build/browser
gates, push the revert commit(s), then verify Pages and public routes. This record
can remain as history; it has no runtime dependency. Do not clear IndexedDB.

Alternatively, disable flags in `config/features.json` and rebuild/redeploy.
Comparison can be disabled independently; library-off always implies both-off.
The browser suites also test disabled gates so the publication check does not
force features back on. Static flags are not instant remote switches.

Automation rollback is separate from Git: a private local copy of its previous
configuration is retained; restore via the app task tool if requested. The news
task remains restricted to actual `gpt-5.6-luna`; this release does not generate a
new weekly report or claim the weekly generation pipeline has been verified.
