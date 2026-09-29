# Whole-site design refactor acceptance

## Scope and provenance

Project-only skill: `.agents/skills/awesome-design-md/`; project contract: `DESIGN.md`.
Pinned upstream: VoltAgent awesome-design-md `f6961238d5cddcf8042a74a70fc400ec67181abb`.
The upstream is a DESIGN.md collection, not an executable skill. The wrapper bundles
the unmodified Linear/Mintlify references and MIT license. No global installation,
remote fonts, API keys or user profile data are required.

## Route/state matrix

All route families below are covered by functional regression checks and visual
inspection. Evidence is from production builds, not development-only previews.

| Family | Routes and states | Regression evidence |
| --- | --- | --- |
| Shell | Skip link, desktop/mobile navigation, Escape and focus return, active section, footer, route vs query scroll | `tests/design-browser.mjs` |
| Portal | `/`, four data-driven modules, entry actions, future planned modules | Design browser + screenshot inspection |
| Curriculum | `/learn`, search, paging, empty, refresh; bilingual category/track links | Curriculum unit tests + design browser |
| Categories | `/category/:slug`, SGLang overview and tracks, mobile topic navigation, missing category | Design browser traverses every linked category/track, with at least 15 distinct categories |
| Reader | `/article/:slug`, source, lazy content, ZH/EN, TOC collapse, anchors, code copy, previous/next, loading/retry, missing article | Curriculum units, design and reader-recovery browsers; all 278 article/language routes passed mobile layout and content checks |
| System map | `/knowledge-graph`, module selection, relationships and detail panel | Design browser: select menu and keyboard node activation; screenshot inspection |
| Model concepts | `/models/knowledge`, all nine topic routes, prerequisite/example/course links | Knowledge render and model browser |
| Catalog | `/models`, search/FFN/attention/sort, 2–3 selections, empty/invalid/refresh | Catalog render and model browser |
| Model workspaces | `/models/:modelId`, all architectures, diagram/cache/weights, dialog, precision, TP/EP/PP/Attention DP/replicas, final layer/rank, URL | Model render/browser, weight precision/deployment browser, checkpoint/packing render |
| DPA | `/models/glm-5-2/dpa`, `/models/qwen3-8b/dpa`, load/group/rank/precision/buffer views | DPA units/render and model browser |
| V4.1 reference | `/models/deepseek-v4-1-flash`, workspace tabs, source owners, layer/rank/quantization, cache/weight scopes | V4.1 units/render and model browser |
| Comparison | `/models/compare`, models/shared conditions/scopes, chart, sharing, incompatible scenarios | Comparison units/render and model browser |
| Profiling | `/operators`, local single/multi-file and directory imports, reconciliation/inventory, evidence candidates, Host/API/Step tables, all-stream timeline, per-hotspot counters, phases, A/B, errors/cancel, anonymous export, estimator handoff | Profiling units and three browser suites; local real-capture validation described in `profiling-evidence-upgrade.md` |
| Estimator | `/operators/estimate`, hardware/operator/dtype/layout, invalid/zero/bounds, transferred sample, reset | Estimator units/browser |
| Profiling guide | `/operators/guide`, linked from workbench only; lazy reader, TOC, glossary, synthetic examples, disclosures, in-module analysis retention, back/refresh, loading/failure recovery | `tests/profiling-guide.test.mjs`, `tests/profiling-guide-browser.mjs`; no private capture assets |
| Multi-rank Profiling | `/operators/ranks`, local multi-capture import, clock/identity/scope confirmation, exact interval coverage, manual communication pairing, controllable timeline, reduced motion, 64 domains, errors/cancel/export/privacy and route retention | `tests/multi-rank-profile.test.mjs`, `tests/multi-rank-browser.mjs`; separate build-time gate in `config/learning-features.json` |
| MoE routing sandbox | `/models/moe-routing`, deterministic Top-K, EP to 64, drop/pad policies, selected-token weighted combine, result-first layout, controllable dispatch/combine animation, reduced motion, strict URL state and error recovery | `tests/moe-routing.test.mjs`, `tests/moe-routing-browser.mjs`; independent `config/moe-routing.json` gate; release evidence required before publication |
| Token execution journey | `/models/token-journey`, queue/prefill/decode/sample/release, chunk/prefix/EOS/cancel, result-first per-rank BF16 KV, distinct sampled/consumed positions, tensor microscope and causal mask, finite playback/reduced motion, strict URL and loading recovery | `tests/token-journey.test.mjs`, `tests/token-journey-browser.mjs`; independent `config/token-journey.json` gate; scoped rollback and Pages verification required |
| News | `/news`, daily/library/releases/archive/saved, categories/topics/source/search/sort, source outages, loading/error/retry, bookmark/import/export/share privacy, weekly | News units/render, design browser and archive outage/recovery browser |
| Weekly reader | `/news/weekly/:period?`, lazy historical reports, freshness/coverage/legacy labels, sources, Markdown export, unknown period, back/refresh, delayed/failed body recovery | Weekly units and four-width `weekly-news-browser.mjs`; included in publication smoke gate |
| Supporting | `/about`, loading/empty/missing routes | Design browser |

## Evidence log — 2026-09-27

- Skill schema validation: passed using `quick_validate.py` with isolated PyYAML.
- TypeScript and ESLint: passed after shared shell and page hierarchy changes.
- Production build: passed; 276 article bodies remain isolated from route bundles.
- Existing SSR suites: model comparisons/catalog/V4.1/DPA/directory/weights, news,
  and nine knowledge topics passed. Styling-specific H1 assertion updated to the
  shared header markup without weakening title/content assertions.
- Full unit run exposed one pre-existing fixture assumption: the mixed-precision
  matrix treated newly supported TP16/32/64 as compatible with every FP8 block
  shape. Tests now assert invalid policies reject and still reconcile every
  valid policy. Domain calculation code has not been changed by this refactor.
- All 310 unit tests passed after updating that fixture, and every existing
  `*-render.mjs` script passed.
- Existing browser suites passed at 360/390/768/1440px: model catalog and tools
  (351 overflow checks), per-weight precision (44 layout checks), combined
  weight deployment through 64, Profiling A/B, single-profile diagnostics,
  and all estimator hardware/operator/validation scenarios.
- Reader recovery browser passed delayed body loading, chunk failure, page-reload
  recovery, adjacent-course navigation, denied/successful clipboard and archive
  failure/recovery. Browser tests use isolated contexts and verify no uploads.
- New `tests/design-browser.mjs` covers 27 route/state entries at four widths,
  keyboard/mobile navigation, curriculum search, bilingual reading/anchors,
  query-scroll stability, news bookmarks and import/export using isolated data.
- Design browser passed 212 layout/route checks across four widths, including
  every category and SGLang reading track. Additional interaction assertions
  cover browser back/forward state, touch-sized code copy and duplicate-title
  suppression while retaining incoming source anchors.
- All 139 articles were opened in both language modes (278 reader states) at
  390px. Titles, lazy bodies and language fallbacks passed, with no document
  horizontal overflow. Long inline code/path wrapping was corrected rather than
  clipping the page; code and tables retain their own scroll containers.
- Screenshot inspection covered home, curriculum/category/track, article and
  table, system map and selected detail, model concepts/catalog/comparison,
  structure/cache/weights, DPA/V4.1, profiling/estimator, news daily/long reads/
  releases/archive/saved/weekly, about and missing routes. It identified and
  resolved the mobile TOC layout shift, duplicate article title and compressed
  SGLang track badge. Diagram semantic colors remain intact.
- Domain modules and curriculum/news datasets have no changes in this refactor.
  Profiling imports and reading-list fixtures use isolated browser contexts;
  no user data, browser profiles, private paths, API keys or new remote font
  dependencies are included in the delivered changes.
- Publication gate: verify the Pages workflow for the pushed revision, then run
  the route/interaction suite against the public site. The delivery message
  records the published result; local checks alone are not deployment evidence.

## Reliability increment evidence — 2026-09-28

- TypeScript, ESLint and all 334 unit tests passed, including calendar-week
  deadlines, citation matching, partial coverage, immutable legacy data and
  publisher backfill/idempotency tests in temporary synthetic repositories.
- News SSR and the production build passed. Four-width browser checks passed
  for weekly status/history/export and delayed/failed body recovery, the
  Profiling guide, and weight-deployment controls/calculations.
- Weekly screenshots were inspected at 360px and 1440px. No horizontal document
  overflow, private captures or uploaded test data were introduced.
- Freshness monitoring intentionally reports the outstanding weekly backlog;
  passing code checks do not imply that a new Luna report has been generated.

## Reproducible QA

1. `npm run check && npm run lint && npm run build`
2. `node --experimental-strip-types --test tests/*.test.mjs`
3. Run all existing `*-render.mjs` checks and browser suites listed above.
4. Start `npm run preview` and provide `MODEL_QA_BASE`, an installed
   `MODEL_QA_PLAYWRIGHT` and optional `MODEL_QA_CHANNEL` to browser scripts.
5. Run `node tests/design-browser.mjs`; optional `MODEL_QA_SCREENSHOTS` stores
   screenshots outside the repository. Inspect each page family, not just home.
   Run `node tests/reader-recovery-browser.mjs` for injected failures and
   `node tests/curriculum-browser.mjs` for every article/language layout.
6. After authorized publication, verify Pages deployment and live interactions.

No screenshots, browser profiles, imported traces or reading lists are committed.
