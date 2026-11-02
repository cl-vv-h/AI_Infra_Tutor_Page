# Curriculum guide — 2026-11-02

## Scope and versions

- Remote baseline: `155360740a4f7d483c9d0c5b55ff989dce007212`.
- Preparation/catalog commit: `43af6e5925e480f52b6cbe9ecc2f31e544139b40`.
- Feature/content commit: `762848235b113f2c4f0ee993b5433ffb47a4b825`.
- Category compatibility and browser gate: `f2226069f407c518fe7eab8f9edf6c9a2c512665`.
- Source tutorial snapshot: `19be702f0842301583b6d84a98c9e42a9f9b35e5`.
- Calculation version: no calculator, numerical formula or estimation contract changed.

The teaching entrance now offers eight domains, four learning paths, and 47
topic guides. Topic guides distinguish principles, runtime, platform, experiments
and cases. Existing readers add a topic return/continuation panel; cache and DPA
include short orientation points. Original article prose and old routes remain.
Missing source files were added from committed objects, not working-tree drafts.
The site now indexes 172 entries and loads 342 language bodies independently.
No existing adapted body was overwritten. English availability is file-based;
Chinese annotated source in the English tree is disclosed. Six interactive HTML
diagrams remain upstream resources rather than being executed in the site.
Static diagrams retain their license notices under `learning-assets-licenses/`.

## Verification

- Directory coverage/relationships, translation availability, planned-item
  isolation and original 139 article URLs: unit checks.
- Existing complete unit suite and the three new guide checks; type/lint/build.
- Bundle check: 342 independent bodies, no eager course text on route entry.
- Guide browser: 360/390/768/1440px, domain/path/topic pages, KV/DPA to reader,
  keyboard activation, back/reload, invalid topic, failed lazy chunk/recovery,
  local-storage sentinel retained.
- Existing reader recovery: failed body/reload, adjacent navigation, clipboard,
  news archive failure/recovery and no uploads.
- Existing design-browser matrix: original categories, search, reader language,
  model query scroll and news storage flows.

The old long articles remain intact; this release does not claim that all long
source courses have been rewritten or all device examples have been executed.
Per-lesson implementation revisions still require the review documented in the
catalog. Source snapshot identity is not hardware compatibility certification.

## Build-time switch and withdrawal

Set `config/curriculum-guide.json` to `{"enabled":false}`, rebuild, and deploy to
restore the old teaching entrance. Reader topic panels disappear; the existing
category/reader remains usable and local data is untouched. Static hosting does
not provide instant remote switching. New topic URLs resolve to the legacy
teaching entrance when the gate is disabled.

For a full functional withdrawal, revert the dependent commits in this order:

```sh
git revert f2226069f407c518fe7eab8f9edf6c9a2c512665
git revert 762848235b113f2c4f0ee993b5433ffb47a4b825
```

The catalog preparation can remain; it changes no frontend. To withdraw that
preparation as well, only after the two commands above:

```sh
git revert 43af6e5925e480f52b6cbe9ecc2f31e544139b40
```

Publication documentation may be retained as historical evidence. Keep later
news commits. Stop on conflicts and preserve the checkout; never reset or force
push. Re-enable by reverting the withdrawal commits in reverse order, then run
checks and rebuild.

Rehearsal uses a separate temporary checkout and a synthetic intervening archive
file. The disabled build restores the original entrance. Feature withdrawal
restores the old reader while retaining synthetic news. The final round also
re-enables both functional commits and checks topic access and a browser storage
sentinel. Synthetic data and rehearsal commits are never pushed.

## Publication condition

Only declare online delivery after the Pages workflow for the pushed commit
succeeds and the public teaching entrance, cache/DPA topic and reader are
operated successfully. Local tests alone are not publication evidence. The
workflow history for this release provides the associated SHA and deployment
result; final live checks are reported in the delivery conversation.
