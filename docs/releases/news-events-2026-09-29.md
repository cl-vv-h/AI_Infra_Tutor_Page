# News event tracking — release and targeted withdrawal

## Identity

- Baseline: `950edc25c5db5fc361b0a027178dcbcc8b796a9e`.
- Feature, gate, data pipeline, UI and tests:
  `c588b1c9038888662296cac9c92b56d899a223f0`.
- Evidence definition: `news-events/1`.
- Shared core Git blob: `ca3aab3d9f5870ea5692e22495975b371f7ecdf2`.
- Initial evidence fingerprint:
  `0d1f673757ef7e4a1e5ae50163a692df876567ab4c01bafb08683366ab642e49`.
- Route: `#/news/events`, linked from the existing news page.

This increment adds four real tracked themes, 13 attributed reviewed milestones
and an initial 22 canonical related reports derived from existing collected
evidence. It is not a static demonstration: the daily workflow recompiles a
retained, validated index after news and release collection. Automatic matches
stay separate from reviewed milestones. Dates and editorial scope are explicit.
The initial collection cutoff is September 28; the editorial review date is
September 29. No build timestamp is presented as new collection.

Existing daily/library/release/archive/weekly data is byte-unchanged from the
baseline. Only the catalog and event index are new news-data files. No credentials,
accounts, uploads, browser storage, unrelated model changes or rejected deployment
scenario library are introduced. This is not a new Luna weekly publication.

## Local verification

- Type checking, lint, build and all 392 unit tests passed; 18 new cases cover the
  catalog/index schemas, literal source/date rules, unsafe URLs, calendar bounds,
  alias/cross-day deduplication, retention, metadata revisions, changed rules,
  deterministic evidence fingerprints, archive gaps, stale evidence, unknown IDs,
  filtered reading, Markdown attribution and parse/read/write/rename failures.
- Real compiled index check is deterministic and clean on repeat. Twenty-seven
  legacy archive observations rejected by the HTTPS URL policy are counted in
  coverage, not silently represented as complete coverage.
- Four-width browser suite (360/390/768/1440px) passed all categories, source
  attribution, event/publication date distinctions, keyboard navigation,
  back/refresh, search, empty results, pagination, Markdown download and privacy.
- Finite animation completion, pause, replay, filter/route/hidden-page stop,
  changed reduced-motion preference, unknown routes/nodes, expired collection
  and review dates, lazy-resource failure/recovery and learning links passed.
- Visual inspection covered the initial viewport and source-evidence card at all
  four widths; no horizontal document overflow. Introductory text was moved out
  of the first-result area after mobile inspection. The timeline presents order,
  never a misleading calendar-time animation scale.
- Complete publication smoke runner passed weekly history/recovery, Profiling
  teaching, model weight deployment, multi-rank analysis, MoE, Token journey,
  communication and event tracking. News SSR, weekly integrity, model render and
  knowledge render checks passed. No browser test was removed to pass release.

Publication still requires successful Pages build **and deploy** for the pushed
revision and the event browser suite against the public URL. Local results alone
do not establish an online release; workflow evidence is retained in GitHub
Actions for the release commit. `docs/news-events.md` describes maintenance limits.

## Rehearsed withdrawal

The feature has one independently reversible implementation commit. Fetch and
inspect current main first, preserving later news and user changes. Revert:

```sh
git revert --no-edit c588b1c9038888662296cac9c92b56d899a223f0
```

Retain this historical record. Never reset main or force-push. Stop on any
conflict, particularly if a later daily run has changed the new event index;
do not resolve a modify/delete conflict by discarding later evidence blindly.
After review, verify the old news/weekly routes and publication before declaring
withdrawal. Re-enable by reverting the actual withdrawal commit.

The release-record commit initially edited the same roadmap line introduced by
the feature. The follow-up restores that line to the feature's exact wording so
the single-commit withdrawal remains clean; "requires release verification" is
the continuing publication gate, not an assertion that publication failed.
The final tree, including this record, was rehearsed again before the final push.

Alternatively set `config/news-events.json` to `{"enabled":false}`, rebuild and
publish. That hides the route/link while retaining public event data and daily
compilation. It is not an instantaneous remote switch and never deletes local
reading lists or IndexedDB databases.

An isolated rehearsal passed enabled → disabled gate → targeted revert → reapply.
A synthetic intervening modification to the existing news library was byte-
preserved in both withdrawal and restoration. The withdrawn tree equalled the
baseline except for that news marker; the restored tree equalled the feature
tree except for the same marker. Reverted type/lint/build checks passed.
In one fresh browser profile, exact synthetic IndexedDB/localStorage values
survived every phase, and news, weekly, communication, Token and MoE routes
remained operational. Rehearsal commits, fixtures and browser profiles are not
published.
