# MoE routing sandbox

Route: `#/models/moe-routing`, linked from the existing model section navigation.
No new home module, accounts, storage, uploads or deployment-scenario library.

## Scientific contract — `moe-routing/1`

This is a deterministic, synthetic single-layer educational simulation, not a
production router, runtime benchmark or deployability estimator. Source rank is
`floor(tokenId * EP / N)`; experts are contiguous, equally partitioned across EP.
N is 1–128, E and EP are 1–64, K is 1–min(E, 8). These are UI teaching bounds,
not hardware deployment bounds. EP must divide E. There is no TP, PP, shared or
replicated expert, residual, learned weight or dynamic expert placement here.

Each token chooses K distinct experts. Selected scores are normalized by
Softmax. Patterns are deterministic cyclic scores, seeded uniform scores, or
seeded scores with a bias toward the first K experts. The cyclic mode ignores
the seed; it does not implement an auxiliary balancing loss.

For bounded capacity, `C = ceil(N * K / E * CF)`, with CF in [0.25, 4]. Each
expert admits the highest selected-normalized router weights, breaking ties by
token identity. No rerouting occurs. Dropless has neither dropping nor padding.
The padded policy discards overflow and adds zero-contribution slots to C;
padding does not create tokens. After dropping, users explicitly choose either
original weights or renormalization of surviving weights. A fully dropped token
has zero output but retains its identity and sequence position.

The two-dimensional toy expert is `f_e(x) = [x*(e+1), x+e/10]`, where
`x=(tokenId+1)/10`. Combine sums each accepted output weighted exactly once.
It is not a learned FFN or a language model prediction. EP changes placement
and communication, not route selection or these numerical outputs.

Dispatch preserves identity in expert-major order. Statistics separate local
expert assignments, remote expert assignments and unique (token, destination
rank) pairs. None is an actual packet count, network byte count or latency.
Expert and rank peak/mean ratios use pre-capacity assignment counts, not time.
Animation stages express dependency, not measured duration or overlapping
collectives. Reduced motion disables automatic playback but keeps every stage
available through keyboard-operable controls. Edits pause playback and remain
explicitly unapplied until validation succeeds. Invalid URL versions, duplicate
fields and unsupported configurations produce errors instead of silent changes.

Reference boundaries: [Megatron Core MoE documentation](https://docs.nvidia.com/megatron-core/developer-guide/0.15.0/api-guide/moe.html)
documents EP, dispatcher and capacity options; the [sparsely gated MoE paper](https://arxiv.org/abs/1701.06538)
motivates sparse expert selection and weighted composition. This tool's score,
admission, toy-expert and display policies are explicitly authored choices,
not claims to reproduce either source's complete implementation.

## Verification and independent withdrawal

`npm run test:moe` checks parameter round trips and rejection, determinism,
capacity and padding, conservation, ownership to EP=64, packed ordering,
independent weighted sums, and output invariance under EP changes.
`npm run test:moe:browser` exercises four viewport widths, presets, edits/errors,
refresh/back, pagination, keyboard, playback, reduced motion and failed lazy
chunk recovery. It is included in `test:smoke` and hence the Pages publication
gate. Screenshots and browser profiles stay outside the repository.

`config/moe-routing.json` is an independent build-time gate. Set `enabled` to
false and rebuild/redeploy to withdraw the route and entry; other features
remain available. This is not an instant remote kill switch. The browser suite
verifies the disabled state when the configuration is false. No local data is
removed in either direction. The release record documents exact Git revert
commands and the actual isolated rehearsal before publication.

The optional standalone flow diagram is generated with project-local Archify
from `docs/diagrams/moe-routing.dataflow.json`. The renderer license accompanies
the HTML; private evidence sidecars are deliberately excluded from public assets.
The interactive sandbox itself derives from live simulation results, not the
static companion diagram. See the release record for byte-bound validation and
visual-review evidence.
