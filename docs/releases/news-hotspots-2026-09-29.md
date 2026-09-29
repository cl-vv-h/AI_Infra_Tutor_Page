# News hotspots — release and targeted withdrawal

## Identity and scope

- Remote baseline: `5d0daaa38af37fc166fa26453ee6407cc98496f0`.
- Expanded public-news data: `414808180e7f8505b9bf284fa976c76edf146c08`.
- Hotspot feature, pipeline, gates and tests: `0cddbdce8ee4e4238fb21f61ad9ec42db4bf33ba`.
- Narrow heatmap readability and corresponding browser assertion: `7d0626fd0aed659113b2f2ef4b641f50efca87c9`.
- Calculation definition: `news-hotspots/1`; shared core blob `1be803b418fb19b33df26ab25242eaa90538db3b`.
- Initial collection cutoff: `2026-09-29T06:52:28.532Z`.
- Initial sample: 815 retained headline records, 39/39 responding feeds; the default
  72-hour view contains 307 reports in 224 topics / headline leads. Counts are an
  observation of this snapshot, not a permanent product promise.

The data commit precedes implementation deliberately: withdrawing UI/collection
changes must not withdraw newly collected daily/library/archive news. No existing
weekly report is changed; this is not a new Luna report publication. No accounts,
API credentials, private traces, browser profiles or personal follow lists are
committed. See `docs/news-hotspots.md` for algorithm and data limitations.

## Verification

404 unit tests passed, including 12 new hotspot cases. Type checking, lint,
production build, event-index consistency, weekly-library integrity and news
render checks passed. The complete critical browser runner passed weekly reports,
Profiling teaching, weight deployment, multi-rank, MoE, Token journey,
communication, reviewed events and hotspots. The hotspot suite derives its
subjects from the current data instead of requiring today's headline to stay
current forever.

Hotspot browser checks cover 360/390/768/1440px, ordered numeric scores, time and
source-region selection, category distribution and count matrix, no document
overflow, search/empty states, URL/back/refresh, keyboard activation, local follows,
cross-tab preservation, new-record counts, explicit mark-read, denied/corrupt
storage, missing IDs, stale snapshots and failed lazy-resource recovery. Visual
inspection covered each initial viewport, topic details and distribution panels;
heatmap labels remain single-line in a named horizontal-scroll region.

Publication requires the actual Pages workflow build **and deploy** to succeed for
the pushed revision, followed by live browser verification. GitHub Actions retains
that evidence; this local record does not substitute for deployment success.

## Exact withdrawal

Fetch and inspect current main; preserve later commits. Revert only the feature
changes, newest first:

```sh
git revert --no-edit 7d0626fd0aed659113b2f2ef4b641f50efca87c9
git revert --no-edit 0cddbdce8ee4e4238fb21f61ad9ec42db4bf33ba
```

Keep `4148081` and later news-data updates. Keep this historical record. Do not
force-push, reset main, delete local follow data or discard conflicting later
changes. If either revert conflicts, stop and preserve the conflict state for
review. Re-enable by reverting the actual withdrawal commits in reverse order.

Alternatively set `config/news-hotspots.json` to `{"enabled":false}`, rebuild and
publish. The default events route returns to its reviewed chronology and the
news-reader link uses its original wording. This is not an instant remote kill
switch. Source collection and retained public metadata continue; no local data is
cleared. The gate-off build has its own browser acceptance path.

An isolated rehearsal retains one browser profile across enabled, disabled,
reverted and restored builds. It checks the default route, existing BOJ deep link,
news reader, actual follow created through the UI and an unrelated localStorage
canary. A synthetic later news commit is preserved byte-for-byte; the news-tree
Git object remains `167e1b9f5165e9909fc989e906dc904c6196b03d` throughout the
rehearsal. The final withdrawal sequence also includes the readability fix and
this independent release record. No rehearsal commit is pushed to main.
