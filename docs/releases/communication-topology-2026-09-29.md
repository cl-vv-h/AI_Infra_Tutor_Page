# Communication topology — release and targeted withdrawal

## Identity and scope

- Baseline: `7a084b60fb4c3c0953eccec9c0a7f0b8dd9f2ccf`.
- Feature, gate, calculation contract and tests:
  `ed8d9fe13c7c5020b3b131fb1dce2415b429fc81`.
- Browser-test disclosure correction:
  `748cf9bd06154bf47a9ec8e871884e528af241aa`.
- Calculation version: `communication-topology/1`.
- Calculation Git blob: `f0b14425042d92fd397fe1b093305c9982e80485`.
- Route: `#/models/communication`, in the existing model navigation.

No news, accounts, credentials, telemetry, raw captures, storage migrations or
deployment-scenario library are added. Existing Token journey, MoE, Profiling,
model comparison and calculators remain. `docs/communication-topology.md` defines
the exact rank conventions, algorithms, byte accounting and hypothetical timing.

## Verification

- Type checking, lint, production build and all 374 unit tests passed.
- Eleven new unit cases cover strict versioned URL state, axes through 64,
  logical groups, physical placement bijection, 262,144-rank addressing, Ring
  and Tree results, every intermediate Ring contributor set, Reduce-Scatter
  ownership, Gather ordering, all non-self A2A pairs, PP isolation, byte counts,
  full-duplex/shared-NIC service constraints and singleton zero communication.
- Browser interactions passed at 360/390/768/1440px, including every algorithm,
  exact numeric witnesses, cross-host placement, refresh/back, keyboard controls,
  invalid draft retention, large-world pagination, singleton cases and no uploads
  or new local/session storage. Numerical state advances only at completed rounds.
- Playback completion, exact pause, reduced-motion change, hidden-page stop,
  pending-route stop, disabled stale controls, invalid URLs and failed lazy-module
  recovery passed. Companion HTML SHA-256 and its MIT notice are checked by the
  browser suite, including against the public site during publication validation.
- Result-first and detailed message/witness views were visually inspected at all
  four widths. Mobile parameter editing collapses; wide data remains in a named
  scroll region. No horizontal document overflow was found.
- The full critical browser runner passed weekly history/recovery, Profiling
  guide, weight deployment, multi-rank analysis, MoE, Token and communication.
  News SSR, weekly library integrity (two reports), model render and knowledge
  render checks passed. News data is byte-unchanged from baseline; this feature
  does not claim a new Luna weekly report.
- An added companion-link assertion initially failed because it addressed a
  link inside a closed disclosure. The test now opens the disclosure as a user
  would; the full runner was rerun successfully. No check was removed or skipped.

Pages publication is a separate gate: require the workflow for the exact pushed
SHA and its deployment job to succeed, then run the full communication browser
suite against the public URL. Local evidence alone is not an online claim.

## Rehearsed withdrawal

From a clean isolated checkout, fetch current main and inspect intervening work.
Revert these commits in this exact order; retain this historical release record:

```sh
git revert --no-edit 748cf9bd06154bf47a9ec8e871884e528af241aa
git revert --no-edit ed8d9fe13c7c5020b3b131fb1dce2415b429fc81
```

Stop on conflict and preserve the working state. Do not reset main, force-push,
or restore an entire repository snapshot. Re-run old-route, build and publication
checks. Re-enable by reverting the actual withdrawal commits in reverse order.

Alternatively set `config/communication-topology.json` to `{"enabled":false}`,
rebuild and publish. The route/nav gate is independent of the other learning tools;
it is not a remote live switch and never deletes browser storage. Its optional
static diagram remains addressable until a full feature withdrawal.

An isolated rehearsal verified enabled → gate disabled → targeted withdrawal →
re-enable, including the final two-commit withdrawal sequence. A synthetic news
commit made after the feature was byte-preserved. The withdrawn tree matched the
baseline except for that sentinel, and the restored tree matched the final feature
tree except for the same sentinel. Withdrawal type/lint/build checks passed.
The same fresh browser profile retained exact synthetic IndexedDB/localStorage
canaries throughout; Token, MoE, multi-rank and existing comparison stayed usable.
Rehearsal commits, data and browser profiles are not published.

## Archify companion receipt

- Diagram type: `architecture`.
- Specification: `docs/diagrams/communication-topology.architecture.json`.
- Output: `public/diagrams/communication-topology.html`.
- Specification SHA-256:
  `fa5ac221699c2f05da25f0bb08f489ce0316d5b1e545d58e2ec76119147089a3`
  (2,353 bytes).
- Artifact SHA-256:
  `0e2389ee7d2545646d6e457066d04c6807c6d7dae7acb7bdea21773336ce12ac`
  (805,960 bytes).
- Deterministic delivery: 9/9 showcase; zero composition errors or warnings.
- Automated browser evidence: passed. READ/Still containment at 1440×900,
  1600×1000, 1920×1080 and 2048×1320; light/dark captures at both endpoint sizes.
- Perceptual visual review: passed, separately from automated evidence. Both
  themes at 1440×900 and 2048×1320 were inspected for crossings, label clearance,
  node/card fit, balanced vertical layout and unobstructed viewer chrome.
- Correction rounds: 0.

The single diagram illustrates directed A→B paths through shared host budgets;
it does not replace the interactive collective simulation or claim real hardware
topology. Its independent MIT notice is `communication-topology-LICENSE.txt`.
Private browser receipts, image sidecars and machine paths stay outside the repo.
