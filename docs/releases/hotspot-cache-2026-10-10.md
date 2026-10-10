# Hotspot snapshot reuse — 2026-10-10

## Scope

- Remote baseline for this delivery: `87f825580822674b170dfc2ab57f0618ad484f1e`.
- Independent fix: `25f0a78618004de9e7b09a98e56c8bc3354e4e45`.
- Calculation definition remains `news-hotspots/1`; no corpus, score, clustering,
  URL, follow format or storage changes.
- Baseline Pages run `37991706377` and initial Attention release run
  `38024076044` both failed the existing followed-topic reload assertion while
  the news route was still loading. The assertion and its timeout remain intact.
- The page rebuilt the same 30-day cluster index in the parent on every render,
  again in the detail, and on follow-state changes. The reader now lazily reuses
  at most four supported windows for one immutable validated snapshot. A replaced
  snapshot must receive a new reader; failed calculations are never cached.
- `config/news-hotspot-cache.json` is an independent build-time switch. Set
  `enabled` to `false` and rebuild to call the original builder on every read.
  No persistent cache or remote kill-switch is introduced.

## Verification and withdrawal

Four tests cover lazy reuse, window bounds, snapshot isolation, retry after
failure, disabled fallback, exact output parity for all supported windows and
unchanged input data. The complete unit suite has 418 passing tests. TypeScript,
ESLint, production build, event index, weekly library integrity and news render
checks passed. The hotspot browser suite passes its original refresh assertion
at all four responsive widths, storage rejection and lazy-load recovery.

An isolated rehearsal disabled the cache gate, reverted this fix, and reverted
that withdrawal, rebuilding and testing each phase in the same browser context.
Teaching, original MLA article, model directory, weekly news, a real followed
topic and independent localStorage/IndexedDB canaries all survived. The synthetic
intervening news tree stayed `e482e2547d0f01bcb5e4033c6817742303713e9c`.
After reapplication only that synthetic news file differed from the runtime tip;
the rehearsal commits are not published.

Targeted production withdrawal is independent of the Attention feature:

```sh
git revert 25f0a78618004de9e7b09a98e56c8bc3354e4e45
npm run check
npm run lint
npm run test:unit
npm run build
npm run test:smoke
```

Use a clean isolated checkout of current main. Stop on conflicts and preserve
the conflict state; do not reset, force-push, restore a snapshot or clear browser
data. Retain intervening news. Re-enable by reverting the actual withdrawal
commit. Attention's two runtime commits can be withdrawn separately in the order
documented in `attention-atlas-2026-10-10.md`.

Publication is only established by successful Pages and public-route checks, not
by a local pass or by this likely-bottleneck diagnosis. The delivery response
records the verified external outcome.
