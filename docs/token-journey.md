# A token's execution journey

Route: `#/models/token-journey`. Calculation contract: `token-journey/1`.
Independent build-time switch: `config/token-journey.json`. This is an interactive
teaching simulation, not execution of a model or a deployment capacity claim.

## Scientific scope

The tool uses the existing model registry and `cacheEstimate` / `cacheKvHeads` for
Qwen3-8B and Llama 3.1 8B. Both are Dense GQA baselines with 32 query heads and 8
KV heads. The page exposes TP up to 32, the Q-head divisibility boundary, rather
than offering an invalid TP=64 merely because other site models support it.
Prompt length (1–64), generation limit (1–16), homogeneous batch (1–8) and chunk
size (1–64) are bounded teaching displays, not production limits.

The trajectory is queue → admission → one or more Prefill chunks → sample,
then Decode → sample until EOS / length, followed by release. Prefix reuse
attaches already computed complete pages; at least one prompt position must
remain to recompute final logits. There is no full-prefix-hit optimization.
An EOS ordinal includes the EOS itself; text APIs may hide that token.

The [Transformers 4.50 cache explanation](https://huggingface.co/docs/transformers/v4.50.0/en/cache_explanation)
documents the forward/sample/next-input loop and past/new KV shape relationship.
In this ordinary cached trajectory, producing G outputs requires G−1 Decode
forwards: the initial output uses Prefill logits. At stop, each request references
P+G−1 positions, so the final sampled output has no KV yet. Chunking changes the
number of Prefill forwards, not this terminal count. Token symbols are positional
IDs, never generated text or actual tokenizer IDs.

For each completed forward, the engine exposes Q, new K/V, combined K/V, hidden,
FFN and logical last-position logits shapes. Attention scores are a logical
shape, not an assertion that FlashAttention allocates a dense matrix. The mask
shows causal visibility, not learned weights. All-head causal pairs per rank are
`B × (Hq/TP) × [T × past + T(T+1)/2]`; this is not measured FLOPs.

Cache payload is `2 × B × positions × localKVHeads × headDim × layers × 2 bytes`.
Page capacity rounds each request's positions upward to the selected page size.
For these models, `localKVHeads=max(1,8/TP)`; TP>8 introduces head replication.
All-layer snapshot values refer to the completed forward. The representative
layer microscope is independent and does not incorrectly increment all-layer
bytes when just one layer's cache-write operation is selected.

The row-parallel communication illustration counts only Attention O and FFN down
reductions: 2 per Decoder layer for TP>1, zero for TP=1. It excludes embedding,
vocabulary, sampling, sequence-parallel, fused and backend-specific collectives.
No network duration, throughput or total-memory estimate is inferred.

Cancellation occurs after an explicitly selected safe event boundary. No further
forward or sample is executed; it does not promise immediate abort of in-flight
device work. Release clears request references; optionally complete computed
prompt pages remain with a cache manager. This is an authored retention policy,
not an exact implementation claim about every inference server. Other requests,
existing shared prefixes, page deduplication, metadata and the device allocation
pool are not counted. Reference release is not OS/device allocation release.

## Interaction and privacy

Snapshots are deterministic; URL v1 stores all applied conditions. Unknown,
duplicate, malformed or unsupported parameters produce an explicit resettable
error. Draft edits do not change results until applied. Transition-pending
controls are disabled to avoid edits/step changes landing on the old route.
Back/refresh restore applied conditions; position and cancellation are ephemeral.

Playback is user-started, finite, pausable, step-able and speed-adjustable. New KV
cells enter on a forward event; the progress bar represents event order, not time.
Reduced motion disables autoplay and CSS motion; stepping remains available.
Visibility changes, navigation intent and route/history changes pause playback.
Tensor details and memory definitions remain separate from the primary state.
Positions are paged in groups of 16; each sample automatically reveals its output
page. The causal mask pages queries in groups of eight and uses a named scroller.

No storage, credentials, uploads or external runtime inference service is added.
The primary visual is the parameterized React sequence/cache and causal-mask
view. An optional standalone Archify draft passed deterministic checks but failed
desktop containment after two visual correction rounds. It is held outside the
repository, not linked or published, and is not evidence of visual acceptance.

## Verification and withdrawal

`tests/token-journey.test.mjs` checks URL boundaries, forward/sample conservation,
chunk and prefix accounting, EOS, cancellation at every active boundary, cache
arithmetic against independent formulae, shapes and all allowed TP sizes.
`tests/token-journey-browser.mjs` checks four widths, keyboard, phase snapshots,
causal mask, large pagination, result/draft separation, URL refresh/back, no
outgoing writes, playback/motion, pending navigation and lazy-load recovery.
It also supports the disabled build without requiring the route to be enabled.

Use `tests/token-rollback-browser.mjs` only against an isolated loopback preview.
It preserves one browser profile across disabled/reverted/restored rebuilds and
checks synthetic unrelated IndexedDB/localStorage canaries. Release records must
identify actual tested commits and publication evidence; source tests alone do
not prove a successful Pages deployment. Never revert unrelated news or force
push. A conflict stops automatic withdrawal and preserves the working state.
