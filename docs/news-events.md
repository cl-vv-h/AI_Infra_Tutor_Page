# News event tracking — evidence and maintenance contract

Route: `#/news/events`, linked from the existing news reader. No new homepage
module. Data/rule version: `news-events/1`. Build-time gate:
`config/news-events.json`; disabling it requires rebuild/publication and removes
the route entry without touching news, reports or browser storage.

## Two deliberately different evidence layers

`src/data/news/event-catalog.json` contains editor-reviewed themes, literal match
rules, questions, learning links and short attributed milestones. Each milestone
has a calendar date **and its meaning**, a record/statement/analysis label,
source publication date, actual review date and review scope. A source summary
is explicitly distinguished from reading the original document. A recorded
statement is not verification of everything the speaker claims.

The first edition includes SGLang release changes, Workers platform announcements,
Bank of Japan decision/disclosure dates, and General Assembly proceedings and
national positions. These are real, cited records, not generated sample stories.
The BOJ effective-date milestone reuses the original decision PDF; it is not an
additional independent confirmation. UN articles about several countries are not
several independent publishing organizations. Same-day milestones have stable ID
ordering, not a claimed intraday speaking order. These distinctions are visible
next to the relevant claims.

`src/data/news/events.json` contains **rule-associated reports**, not automatically
verified milestones. `scripts/build-news-events.mjs` reads daily, library, releases
and all daily archives, validates the catalog and previous index, and compiles
related records. The shared implementation is `src/lib/news-events.mjs` (Node 20
and browser compatible). Browser code never fetches articles or runs a model.

Rules combine exact publisher hosts, optional path prefixes, literal title terms,
excluded terms and publication-date bounds. No user-supplied regular expressions,
embeddings or hidden relevance score. The reason for inclusion is inspectable.
Matches can be incomplete or irrelevant; they are never elevated into facts by
match count, publisher location or multiple URLs.

## Dates, deduplication and retention

- Event day and its meaning belong to reviewed milestones. Report timestamps are
  original source publication timestamps, shown as UTC; source day-only dates
  remain day-only. BOJ local publication days are not relabelled UTC.
- First/last collection come from observed `fetchedAt`, **not rebuild time**.
  Repeated rolling-feed items do not acquire a new collection time merely because
  the containing library was rebuilt. An editorial-only citation with no matched
  report says its collection time is unavailable.
- Canonical HTTPS URLs strip known tracking parameters and fragments; UN feed
  aliases normalize to the article URL. Content query parameters remain.
- Same URL across windows is one related record. Different URLs remain separate;
  they do not imply independent corroboration. Latest observed metadata wins;
  earlier archived metadata cannot overwrite later observations. Ties use a
  deterministic lexical identity ordering, not an inferred correction time.
- Prior records survive rolling-window expiry. Changed catalog rules re-evaluate
  retained membership. Intentional theme/rule removals can remove associations;
  Git retains the public history. No stored full article text or raw HTML.
- Metadata revision count is index-observed title/publisher/date changes, not
  publisher body-revision tracking. First collection is retained on revision.

## Refresh and failure semantics

The existing daily news workflow runs the generator after feed and official
release collection, before committing the explicit public-data paths. A failure
stops the publish step; previous production data stays published. The generator
validates all required inputs, rejects unknown catalog/index versions, reports
invalid individual observations, and atomically renames a same-directory temporary
file. Read/write/rename failures do not overwrite the previous index.

The index fingerprint binds the catalog, compilation version, coverage and
retained report projection. Identical evidence gives byte-identical output; no
`Date.now()` build timestamp masquerades as collection freshness. Publication CI
runs `npm run news:events:check` before building. The generator has no credentials,
network requests, npm runtime dependencies or LLM requirement.

```sh
npm run news:events
npm run news:events:check
node --test tests/news-events.test.mjs
npm run test:events:browser
```

To maintain a theme: inspect primary evidence, add/update a short attributed
milestone with its real review scope, change `reviewedOn` **only after review**,
regenerate and review the diff. Automatic collection grows the related-report
stream but cannot refresh the reviewed summary. The UI separately flags collection
older than three days and milestone review older than seven days. It exposes
failed sources, invalid input observations, archive date gaps and collection
cutoffs. A valid workflow configuration is not evidence of a recent collection.

All archive coverage is coverage of **this site's selected feeds**, not a complete
internet/news archive. No automatic archive expiry is introduced. The strict
10,000-record-per-theme and 20 MiB input guards fail explicitly; maintainers must
introduce reviewed pagination/archival before exceeding them, not silently trim.

## Interaction and privacy

Latest reviewed milestone opens by default. A controlled finite reading animation
advances one milestone per five seconds, with pause, previous/next and direct
jump controls. Equal visual spacing represents order, not elapsed calendar time.
Reduced-motion preference disables playback and transitions; changes in that
preference, hidden page, route or filters pause playback. Manual selection is in
the URL; transient playback position is not persisted.

URL theme/node IDs are stable. Unknown IDs show a recoverable error, never another
story. Related-report search/source filters are explicit URL parameters; users
are warned that shared links contain their search terms. Related results paginate
in groups of six. Markdown export includes the whole theme, attribution, review
scope, cutoffs, uncertainty and all related reports, irrespective of the filter.
It does not export reading lists or personal data.

The feature does not access browser storage, upload information, add accounts,
change calculators, restore the rejected scenario library, or generate a weekly
report. Weekly summaries retain the actual `gpt-5.6-luna` requirement; news-event
publication must not be described as a new successful Luna weekly publication.

## Verification boundaries

Unit tests cover dates, URL safety, literal matching, unknown versions, schema
errors, aliases, cross-day deduplication, retained evidence, metadata correction,
changed rules, deterministic compilation, missing archives, invalid observations,
atomic failures, URL recovery and attributed export. Browser tests exercise all
four themes at 360/390/768/1440px, keyboard operation, history/refresh, filtering,
export, reduced motion, finite playback, interruption, stale evidence, module
failure/recovery, learning links, privacy and overflow. Full existing critical
journeys remain in the publication workflow. Screenshots and rehearsal browser
profiles stay outside the repository.
