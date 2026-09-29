# Practical improvement roadmap

The site remains a static, privacy-preserving engineering learning workspace.
Ship small verified increments, keeping the existing routes and calculations.
This is a prioritised backlog, not a claim that planned features already exist.

## 1. Reliability and news research — current increment

- Isolate the Luna weekly workflow from unfinished development work.
- Calendar-week planning, catch-up, immutable dated history and evidence checks.
- Freshness/coverage visibility, historical reading, sources and Markdown export.
- Separate content validity from staleness monitoring; gate Pages publication on
  unit tests and core browser interactions, not compilation alone.
- First new Luna run and its public report still require execution verification.

## 2. Deployment scenario library — withdrawn

The user rejected this feature on 2026-09-29. Its save/restore, local library and
scenario comparison have been reverted; do not rebuild or re-enable them without
an explicit new request. Existing cross-model comparison and model calculators
remain available. The rollback does not erase previously stored browser data.
See `releases/deployment-scenarios-2026-09-29.md` for the historical record.

## 3. Profiling experiment notebook

Connect the reading guide to synthetic diagnosis exercises and record before /
after experiments with hypothesis, comparable workload, evidence and outcome.
Default to anonymous aggregates, never persist raw captures or machine metadata.
Any optional local persistence/import must be explicit and safely validated.

## 4. Learning and retrieval

Unify search across lessons, model concepts and tool explanations. Add local
reading progress and focused exercises on quantization, parallelism and trace
interpretation. Link each result to a specific lesson or reproducible synthetic
scenario; avoid generating unsupported technical answers at runtime.

## Maintenance cadence

Weekly review of public deployment/freshness failures and this backlog. Propose
one bounded next increment with evidence and acceptance criteria; do not silently
expand into paid services, new credentials, user accounts or cloud data storage.
Routine news publication remains in its existing Luna automation. Report only
actionable changes, failures or decisions, not repeated unchanged status.
