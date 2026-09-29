# Multi-rank Profiling evidence workspace

Route: `#/operators/ranks`, linked within performance tools, not a new home module.
Build-time gate: `config/learning-features.json` → `multiRankProfiling`. Disabling
the gate and rebuilding hides navigation and gives a useful disabled-route state.
It is not a remote kill switch and never clears browser storage.

## Inputs and identity

Multi-select flat CSV/JSON files treats each as an independent capture. Selecting
a parent directory groups recognized companion views by output directory and
reuses existing `importProfileBundle` reconciliation. Final
`ASCEND_PROFILER_OUTPUT` views take priority over intermediate exports. Logs,
metadata, raw binary and DB files are not read. Each device/PID domain remains
separate, even if two captures use the same numeric device ID. Display rank IDs
are assigned sequentially, not inferred from potentially private path names;
users must verify/relabel identities and participant scope.

Bounds: 4096 selected files, 64 capture/device domains, 50 MiB per file, 256 MiB
of readable input and one million retained device events. Source parser limits
still apply (200000 device events per file). Limit violations reject the import,
never silently sample. Parsing happens in a dedicated Worker. Replacement,
clear, refresh or leaving performance tools discards it; navigation within the
performance area preserves both this workspace and the independent A/B workers.

## Clock contracts

- Default: subtract each capture/domain's own first observed timestamp. This
  compares local shapes, NOT simultaneous events; no cross-rank entry/finish
  ordering is reported.
- Explicit clock mode: `(captureBase − minimumBase) + eventTime + correction`.
  Integral epoch bases are subtracted before adding fractions, preserving the
  existing string-timestamp sub-microsecond handling. The user must confirm
  synchronization and the validity of constant corrections over this window.
- No automatic fitting from the first collective, Notify name, step number,
  recording start or filename. Different ranks need not enter a collective at
  the same time. No drift correction or Perfetto ClockSnapshot import is claimed.
- Per-rank error bound is optional; blank is unknown, never zero. A pairwise
  difference can vary by twice that bound. A spread exceeding it only establishes
  distinguishable observed starts under the declared assumption, not causality.

## Scope and arithmetic

Each domain can select an exact Step and can be excluded. Observation boundaries
are relative to the complete current graph's first time. Intersecting tasks are
clipped for coverage/work; calls count intersecting execution records. Rank
settings, selected event indices and all confirmations are explicit. Changes
show pending-state feedback and disable animation/export until reapplied.

Compute, communication, wait and other/copy are separate interval unions. Wait
and control records never contribute to execution work. Wait outside execution
is `union(wait) − intersection(union(wait), union(execution))`. Uncovered means
the observation window minus coverage of ALL retained roles, not actual device
idle. Classification comes from the existing task-name/type heuristic.

The heatmap covers all timestamped records in 96 equal bins. Eight rank lanes
are paginated; no time tail is dropped. A playhead and keyboard slider inspect
bins; playback is intentionally slowed to a 12-second presentation, not a real
runtime replay. No autoplay. Pause/reset/step/speed/jump-to-communication controls
are available. Reduced motion disables continuous playback; route changes,
hidden tabs, configuration edits and new results stop it.

Record completion spread requires synchronized clocks, confirmed comparable
workload/participants, complete timestamp coverage and no parser-rejected rows.
It is disabled with a user-cropped window to avoid comparing artificial clip
boundaries. It is never labelled request latency, TTFT or critical-path delay.

## Communication evidence, not automatic root cause

Users select an execution communication event from each included rank, then
confirm group, round, participant membership and event granularity. Names alone
never pair events. Lists show bounded pages; more than 5000 candidates requires
narrowing the observation window, while all events still contribute to metrics.
Stable source-event indices prevent Step/window filtering from pairing another
event accidentally. Missing participants or clipped matched events block pairing.

Reported entry spread is max(start) − min(start). An event may be a device
subtask rather than a whole collective. The local wait intersection before the
latest entry is an observed overlap, NOT proof that one rank waits for that peer.
Nearby compute records are labelled candidates rather than dependencies. A true
dependency graph, communication group membership and Notify senders are not
reconstructed; missing evidence is never fabricated.

Two synthetic cases exercise compute straggling (80 µs entry spread) and clock
skew (300 µs known offset, zero entry spread after correction). They are not real
model performance measurements. Real captures use the same import/analysis path.

## Privacy and sources

No raw data, rank identifiers, corrections, file names or event names enter URL,
browser storage or network requests. Explicit JSON export is a numeric whitelist
with anonymous R1… identifiers; performance numbers may still be sensitive.
No API keys, remote analysis service or new database is required.

Method references: [Perfetto clock domains](https://perfetto.dev/docs/concepts/clock-sync)
and [MindStudio fast/slow rank synchronization case](https://www.hiascend.com/doc_center/source/en/mindstudio/830/practicalcases/GeneralPerformanceIssue/toolsample6_008.html).

## Acceptance

Unit tests cover independent epoch bases, interval-union randomized oracles,
clock/pairing/workload gates, missing records, clip boundaries, 64 ranks, large
timelines, privacy whitelist, directory reconciliation, units and input limits.
Browser tests cover 360/390/768/1440px; real Worker file/directory import;
replacement/error/cancel/refresh; A/B preservation; motion/pause/keyboard/reduced
motion; 64 rank pagination; numeric download/privacy and Worker denial.
Tests run in isolated browser contexts, never in the user's browser profile.
