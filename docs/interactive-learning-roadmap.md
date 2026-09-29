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
4. **Communication topology lab — not implemented.** Single/multi-host rank
   placement, collective algorithms and declared latency/bandwidth assumptions;
   theoretical predictions explicitly separate from measured performance.
5. **News event tracking — not implemented.** Multi-day event timelines with
   attributed primary sources, confirmed facts versus viewpoints/uncertainty,
   links to relevant technical learning, maintained within existing news flows.

The deployment scenario library remains withdrawn. These features must not
reintroduce it. Existing news, calculators, A/B analysis and readers stay intact.
For profiling, supporting a synthetic example alone does not satisfy import or
analysis requirements. For news, static mock stories do not satisfy event tracking.
