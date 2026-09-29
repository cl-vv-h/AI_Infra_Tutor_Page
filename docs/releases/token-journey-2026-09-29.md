# Token execution journey — release and withdrawal record

## Identity

- Baseline: `7be023f511ea333cab041babfd69e54d8c3c90d6`.
- Feature, independent gate, tests and teaching contract:
  `8caaacc97bc6b3a00a2198f52856e5c09f49690e`.
- Calculation version: `token-journey/1`.
- Calculation Git blob: `8875112467718ce298ffc901c1d66b0ee74020fd`.
- Route: `#/models/token-journey` in the existing model navigation.

The increment has no news changes, accounts, telemetry, credentials, uploaded
captures, storage migration or deployment-scenario saving. Existing MoE routing,
multi-rank profiling, model comparison and calculators remain unchanged.
Scientific scope and interaction semantics are in `docs/token-journey.md`.

## Verification

- Type checking, lint and production build passed; all 363 unit tests passed.
- Nine new unit cases check strict parameter/version round-trips, Prefill versus
  Decode counts, sample/consume off-by-one, partial chunks and prefix reuse,
  EOS, every cancellation boundary, independent cache formulas, TP replication,
  tensor shapes, causal pairs and scoped row-parallel reduction counts. A bounded
  trajectory sweep covers 54 prompt/output/chunk/EOS configurations.
- Browser tests passed at 360/390/768/1440px: keyboard stepping, causal visibility,
  output versus KV cells, cancellation/release, retained prefix, EOS, malformed
  and duplicate queries, draft validation, presets, refresh/back and large-range
  pagination. P=64 / G=16 / Batch=8 / TP=32 gives 79 referenced positions before
  release, 4× KV-head replication and an uncached final output.
- Playback, pause, reduced-motion change, visibility change, pending route
  navigation and chunk-load failure/reload recovery passed. The transition fix
  disables old controls while a new query is pending. No outgoing writes or
  unexpected cross-origin requests were observed; no local/session storage was
  written by the new page.
- All four widths and the detailed execution panel were visually inspected.
  Main results precede editing, mobile parameters collapse, cache states use
  both words and semantic colors, and no horizontal document overflow occurs.
- The full critical browser runner passed weekly news/history, the Profiling
  guide, weight deployment, multi-rank analysis, MoE routing and Token journey.
- News SSR, weekly library integrity (two reports), model render suites and
  model-knowledge rendering passed. News files are byte-unchanged from baseline;
  this release does not claim to generate a new weekly report.

Publication is a separate gate: the Pages workflow for the pushed release SHA
and the live Token browser suite must pass before announcing availability.
The candidate's local test results alone do not prove a live deployment.

## Tested withdrawal

On a clean, isolated release checkout, fetch current main and inspect intervening
changes. Withdraw only the feature commit:

```sh
git revert --no-edit 8caaacc97bc6b3a00a2198f52856e5c09f49690e
```

If there is a conflict, stop and preserve it for review. Do not force-push,
reset main or restore the entire repository. Historical release notes can
remain. Run the old-route regression checks and publish the resulting revert
before claiming that the public site is withdrawn. Re-enable by reverting the
actual revert commit, followed by the same validation and publication gates.

Alternatively set `config/token-journey.json` to `{"enabled":false}`, rebuild
and deploy. This hides the route and navigation entry independently of MoE and
Profiling. It is not an immediate remote switch and does not delete storage.

An isolated rehearsal performed enabled → gate disabled → targeted revert →
restore. The disabled build's own browser test passed. One fresh browser profile
retained exact synthetic IndexedDB and localStorage canaries through every phase;
MoE results, multi-rank example and existing model comparison stayed functional.
A synthetic intervening news commit was byte-preserved. The reverted tree matched
baseline exactly except for that sentinel; the restored tree matched the feature
commit except for the same sentinel. Rehearsal commits and canaries are not pushed.

## Optional diagram held back

The interactive React cache/token and causal-mask views are part of the tested
feature. A separate Archify lifecycle document was an optional draft, not a
replacement for those views. After two focused visual correction rounds its
latest deterministic validation was 9/9 showcase, zero errors/warnings, but
browser evidence failed: vertical desktop overflow was 524/556/476/260 px at
1440×900 / 1600×1000 / 1920×1080 / 2048×1320. It is not published or linked.
The draft and private receipts are retained outside the repository; neither
machine paths nor screenshots enter public assets. No visual-acceptance claim is
made for that draft.
