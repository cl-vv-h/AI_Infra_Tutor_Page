# Profiling reading guide

Route: `#/operators/guide`. The only new navigation entry is a link on the
Profiling workbench; no homepage module or top-level navigation item is added.

## Evidence and privacy

The lesson was checked against a local Ascend PyTorch capture's output inventory,
headers, public operator types and task categories. It distinguishes observed
names from general semantics and unverified root-cause hypotheses. Official
CANN, HCCL and MindStudio references are linked beside the relevant explanations.
Public API names are not asserted to be the captured low-latency implementation.

The source capture is not copied, uploaded, bundled or committed. Its path,
machine identifiers, raw timestamps, shapes, stack traces and measured timings
are omitted. Numerical examples are explicitly synthetic. Test imports use the
existing synthetic bundle fixture. Screenshots are generated outside Git.

## Reader and state contract

- Lazy reader body with existing Markdown rendering and heading-derived TOC.
- Desktop sticky TOC, mobile disclosure, scrollable tables and keyboard controls.
- In-module navigation leaves workbench workers and imported analysis in memory.
- Refresh and leaving the performance module still clear ephemeral analysis.
- A failed tutorial chunk shows an explicit fallback, with a safe return to the
  workbench. Reload recovery warns that it will clear local analysis.
- No extra third-party assets, storage, API calls or credentials.

## Validation

- `npm run check`, `npm run lint`, production build and curriculum bundle check.
- All 322 unit tests passed, including four guide content/scope/privacy checks.
- Existing profiling A/B, single-profile and evidence browser suites passed at
  360, 390, 768 and 1440 px.
- Guide browser coverage: all section layouts, keyboard TOC/quiz controls, deep
  anchors, back/forward, refresh, analysis retention, no uploads, delayed and
  failed chunk loading, fallback and reload recovery.
- Screenshot review found Markdown punctuation/emphasis ambiguity and wrapped
  task names. The lesson now uses explicit emphasis and locally scrollable tables
  that preserve task labels; neither change affects other readers.

Run `node tests/profiling-guide-browser.mjs` with `MODEL_QA_BASE`, an available
`MODEL_QA_PLAYWRIGHT`, optional `MODEL_QA_CHANNEL`, and optional external
`MODEL_QA_SCREENSHOTS`. Tests never require a real capture.
