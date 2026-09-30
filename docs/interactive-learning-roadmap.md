# Interactive engineering tools — approved scope

The user approved five increments on 2026-09-29, in this order. Each requires
working interactions, meaningful controllable animation, reduced-motion support,
mobile and keyboard QA, explicit scientific limits, a separate commit, a tested
targeted revert and verified Pages publication. No raw profiling is uploaded.

1. **Multi-rank Profiling analysis — implemented; publication tracked in release record.** Local multi-file/directory
   import; independent clock domains; explicit synchronization/correction;
   rank workload/wait coverage and matched communication inspection. No automatic
   causal graph inferred from names, overlapping timestamps or Notify duration.
2. **MoE routing sandbox — implemented; publication tracked in release record.**
   `#/models/moe-routing`: deterministic token/expert routing, Top-K and EP to 64,
   controlled dispatch/expert/combine animation, pre-capacity load imbalance,
   drop/pad policies, explicit combine normalization, toy numerical outputs and
   per-rank logical communication. See `docs/moe-routing.md` for exact boundaries.
3. **A token's execution journey — implemented; publication tracked in release record.**
   `#/models/token-journey`: queue, chunked prefill, sample/decode, EOS/cancellation,
   prefix/page lifetime, Q/KV/FFN shapes, causal masks and scoped TP reductions.
   See `docs/token-journey.md` and `docs/releases/token-journey-2026-09-29.md`.
4. **Communication topology lab — implemented; publication tracked in release record.**
   `#/models/communication`: logical groups and physical placement, Ring/Tree
   All-Reduce, Gather/Scatter, All-to-All and PP transfer; finite stepwise playback,
   numerical witnesses and shared-host bandwidth constraints. Hypothetical timing
   is explicitly separate from measurements. See `docs/communication-topology.md`.
5. **News event tracking — implemented; publication requires release verification.**
   `#/news/events`: four real tracked themes, attributed reviewed chronology,
   automatically associated reports, distinct event/publication/collection dates,
   uncertainty, controlled finite playback, filters, Markdown export and learning
   links. Daily collection compiles a validated retained index atomically.
   See `docs/news-events.md` for matching, maintenance and evidence boundaries.

The deployment scenario library remains withdrawn. These features must not
reintroduce it. Existing news, calculators, A/B analysis and readers stay intact.
For profiling, supporting a synthetic example alone does not satisfy import or
analysis requirements. For news, static mock stories do not satisfy event tracking.

September 30 user-approved extension to news: PULSE is the new `/news` entrance,
with a projected 3D point sphere, direct editorial reading, filter/selection URL
state and the existing local follows. `/news/events` retains the complete hotspot
distribution and reviewed chronologies. Verification and release status are tracked
in `releases/news-sphere-2026-09-30.md`; no new research/report generation is implied.
