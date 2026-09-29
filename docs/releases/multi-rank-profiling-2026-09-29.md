# Multi-rank Profiling — release and reversible delivery

## Identity

- Baseline: `79398d7cc0e1a9e7e4124ad18c5c8b0a9aae3c06`, including the newly
  published weekly signal report. News data is unchanged by this feature.
- Feature: `0c87b76945bf1d3873cfd957579f7f06ee7483b0`.
- Pending-navigation playback fix: `c7dfdfeabc3c780d0019d3ed523c54977ce5fb34`.
- Method version: `multi-rank-evidence/1`.
- Analysis source Git blob: `8e134f95c1d0f2a1763a2310048a4f0be1b9c347`.
- Reused import source Git blob: `23cbc53b3c51ab08d612277ae6cf78a8f7b2888e`.

Route `#/operators/ranks`. This is the first of the five user-approved interactive
increments; MoE routing, token journey, topology and event tracking are not
included in this release. The rejected deployment scenario library stays removed.

## Verification

- Type checking, ESLint, all 347 unit tests and the production build passed.
- New arithmetic tests cover clock precision, random independent interval-union
  oracles, missing and clipped records, manual pairing and declared uncertainty,
  64 domains, full-timeline bins, input bounds and anonymous export.
- New real-browser journeys passed at 360, 390, 768 and 1440px: Worker file
  import, exact demo results, confirmation gates, invalid-window recovery,
  keyboard/step controls, JSON download, refresh and navigation lifecycle.
- Playback/pause, rapid route transitions, reduced-motion changes, compound
  directory import, 64-domain pagination, cancellation, Worker denial and lazy
  chunk failure/reload recovery passed. Desktop and mobile screenshots inspected.
- A user-provided local Ascend directory was read only on the local machine;
  execution count reconciled against an independent raw-trace count. No private
  files, identifiers or screenshots of that capture are published. This one
  capture does not prove every production multi-rank format is supported.
- Existing A/B workbench, single-profile diagnostics, evidence views and guide
  browser suites passed at all four widths. Weekly history/recovery and model
  weight deployment browser gates passed. News rendering and both weekly reports'
  library integrity passed.
- Privacy checks found no raw data in requests, browser storage, history or
  numeric export. Processing stays local; export requires an explicit action.

## Rollback rehearsal

In a separate, never-published managed worktree, add a synthetic intervening
news file and keep one isolated browser context with synthetic IndexedDB and
localStorage data. Disabling the flag and rebuilding hides the new route without
touching these records. Reverting the two feature commits restores the baseline
runtime; the only diff is the synthetic news file. Reapplying the reverts restores
the feature and its 80 µs demo. The existing guide and exact stored values remain
valid in disabled, reverted and restored phases. No rehearsal commit is pushed.

## Production rollback

Work in isolation from the latest main. Inspect intervening changes and preserve
them. Revert only these commits, newest dependency first:

```sh
git revert --no-edit c7dfdfeabc3c780d0019d3ed523c54977ce5fb34
git revert --no-edit 0c87b76945bf1d3873cfd957579f7f06ee7483b0
```

Stop on conflicts and preserve the worktree; never reset main or force-push.
Run that revision's checks/build/browser gates, push normally, verify the matching
Pages run and public route behavior. Keep unrelated news and existing browser
data. This historical record can remain; it has no runtime dependency.

For a temporary disable, set `multiRankProfiling` to false in
`config/learning-features.json`, then rebuild and redeploy. The browser gate also
checks disabled behavior. This is not an instantaneous remote switch. No new
persistent storage was introduced, and no storage is cleared on disable.

The existing improvement automation now follows the user-approved five-feature
order and animation/accessibility requirements; schedule and notification policy
are unchanged. Its prior configuration was privately backed up. The separate
weekly-report task remains restricted to actual `gpt-5.6-luna` generation.

Publication acceptance requires the Pages workflow for the pushed revision and
public-browser verification, not just these local results. The delivery message
records that post-push outcome.
