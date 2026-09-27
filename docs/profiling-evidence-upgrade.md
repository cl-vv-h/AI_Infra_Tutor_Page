# Profiling evidence upgrade

## Scope

Make real Ascend profiler captures useful without sending their contents to a
server. Preserve single-file import, A/B comparison, manual phase annotations,
anonymous export, estimator handoff and the project's design/accessibility rules.

## Required outcomes

- Read a profiler output directory or selected companion files in a worker.
  Show an import inventory with retained, joined, skipped and unsupported data.
  Prefer the final ASCEND_PROFILER_OUTPUT over duplicated intermediate exports.
  Never concatenate duplicate kernel/task/trace tables and count them twice.
- Preserve decimal timestamps before subtracting the epoch. Short synchronization
  events must not disappear because `start + duration === start` in a float.
- Join kernel shapes, formats, task identifiers and pipeline counters to trace
  records only with verified identity/time matches. Reject incompatible captures.
- Recognize documented CANN ratio units with schema evidence. Keep MAC activity,
  Cube utilization, MTE and scalar counters distinct; unknown metrics stay unknown.
- Separate execution from waits/control envelopes. Show task accounting and
  wait coverage without equating cumulative waits with compute work or idle time.
- Read operator, Host API, framework and step summaries as separate evidence,
  never as synthetic device calls. Provide reconciliation and useful drilldown.
- Give quantitative, evidence-linked optimization candidates: workload share,
  pipeline/transfer observations, short-call density, synchronization exposure,
  Host overhead and variability. Explain confidence, missing evidence and next
  measurements; do not promise speedups or infer phases from ordinal steps.
- Keep the summary useful immediately after import, with deeper tables behind
  task-oriented tabs, searchable/paged data and a usable timeline.

## Validation gates

Synthetic regression fixtures must cover precision, source reconciliation,
ambiguous joins, partial/malformed inputs, metric units, privacy, filter semantics,
worker cancellation and existing analysis features. Real-capture checks use an
explicit local environment variable; neither source files, private paths nor
capture-specific results are committed. Compare independent raw row counts with
the importer, inspect the rendered analysis, and exercise it at mobile/desktop
widths. Run type/lint/unit/build and live checks before calling the upgrade done.

## Source semantics

- [CANN output table definitions](https://www.hiascend.com/document/detail/zh/canncommercial/800/devaids/devtools/profiling/atlasprofiling_16_1149.html)
- [MindStudio system tuning metrics](https://www.hiascend.com/document/detail/en/mindstudio/2610/visualization_tool/MindStudioInsight/docs/en/user_guide/system_tuning.md)
- [Ascend C Matmul example with fractional MTE2 ratio](https://www.hiascend.com/developer/techArticles/20240816-1)

## Implementation

- Directory/multi-file reading runs inside a cancellable Web Worker. Only known
  output views are read; raw logs, databases and metadata are inventoried but
  skipped. One capture per slot avoids accidental cross-rank clock mixing.
- Trace identity uses task ID, physical stream, start and duration. Replayed task
  IDs are disambiguated by time; CSV model-ID sentinel differences and equivalent
  DMA labels are supported without weakening ambiguous-match rejection.
- The default evidence overview accounts for all hardware roles and offers
  prioritized findings with links to the full hotspot signature and all available
  pipeline counters. Known CANN fractional ratios and explicit percentages are
  distinguished from unknown units. Missing coverage remains unknown, not zero.
- Host markers retain their actual names, including speculative-verification
  phases. API and framework Self-time rankings remain full-capture observations.
  Operator summaries reconcile against the whole device capture by device/type;
  summaries never generate synthetic device tasks.
- The complete selected timeline uses 64 union-coverage bins per stream, with
  stream pagination and interval drilldown. The older bounded per-task preview
  is secondary and explicitly labeled. Filtering retains complete calls only.
- Anonymous report v3 adds numeric hardware accounting and per-group pipeline
  measurements; it still excludes names, shapes, call stacks, IDs and timestamps.

## Reproducible validation

1. `npm run test:profiling` covers synthetic precision, roles, units, joins,
   summaries, time-filter scope, union timelines and privacy regressions.
2. `npm run test:profiling:browser` exercises existing A/B and phase workflows,
   plus multi-file import, replacement/cancellation, summary search, counters,
   timeline zoom/reset and local-only export at 360/390/768/1440px.
3. Set `PROFILE_QA_DIRECTORY` to a local capture root or final output directory
   when running the evidence browser. Independent raw Trace counting determines
   expected hardware/kernel roles; the browser imports the directory locally and
   verifies joined counts and all summary types. Do not commit the environment
   value or screenshot artifacts. The test never sends file contents to a server.
4. Browser scripts accept `MODEL_QA_BASE`, `MODEL_QA_PLAYWRIGHT`, optional
   `MODEL_QA_CHANNEL` and `MODEL_QA_SCREENSHOTS`. Use a production preview for
   local real captures; use synthetic fixtures for public deployment checks.

Local verification includes the user-provided real capture, all four viewport
sizes, the prior A/B and phase suites, and the full unit suite. No real capture
data or capture-specific performance measurements are included in this repository.
The production build, TypeScript, ESLint, 318 unit tests and all three profiling
browser suites passed locally. Visual review covered the default overview and
expanded evidence, with artifacts stored outside the repository. The directory
test also exercises selecting the capture root, not only its final output folder.

Deployment gate: verify the Pages workflow for the delivered commit and rerun the
synthetic browser flows against the public site before claiming publication.
Local checks alone are not deployment evidence.
