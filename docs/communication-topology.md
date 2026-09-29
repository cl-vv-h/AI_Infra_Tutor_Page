# Communication topology — teaching contract

Route: `#/models/communication`. Calculation version: `communication-topology/1`.
This is a deterministic teaching simulator, not a benchmark, deployment planner,
hardware probe or reproduction of NCCL/HCCL algorithm selection. Every bandwidth
and latency is an editable hypothetical value, not a vendor specification.

## Logical versus physical placement

World size is TP × PP × independent replicas. EP and Attention DP partition TP;
neither multiplies device count. All power-of-two axes support 1–64; PP supports
every integer 1–64. EP and Attention DP must divide TP. Worlds up to 262,144 logical
ranks are addressable, while only the selected group (at most 64) is materialized.
This does not establish model divisibility or backend deployment support.

Rank numbering follows the existing model lab: `r = ((replica*PP+stage)*TP+t)`.
Attention groups are contiguous blocks of TP/AttentionDP; expert-internal TP uses
contiguous blocks of TP/EP; EP holds the expert-internal coordinate fixed across
those blocks. Dense uses all TP ranks of one stage. PP fixes replica and TP
coordinate across stages. Independent inference replicas do not communicate here.

For D devices per host and H=ceil(world/D), packed placement maps r to
`(floor(r/D), r%D)`; striped maps to `(r%H, floor(r/H))`. Slots are abstract teaching
coordinates, not PCIe identities. Group membership does not change with placement.
Only the selected group's participants are shown; other groups' contention is
excluded. Host pagination and per-host disclosure preserve access to every rank.

## Communication and verifiable results

Each synchronous round reads the previous completed state. Messages carry source
contributor sets. Sum-reduction unions disjoint sets; copy replaces the destination.
The visible numeric witness updates only after a round completes, never midway
through an animated message. A2A reads immutable input, not overwritten output.

| Operation | Meaning of S | Algorithm / final ownership |
| --- | --- | --- |
| Ring All-Reduce | Full input per rank | n−1 Reduce-Scatter rounds, then n−1 All-Gather rounds; each message S/n; all ranks obtain all reduced chunks |
| Tree All-Reduce | Full input per rank | Binomial reduce then reverse broadcast; full-S messages; 2ceil(log2 n) rounds |
| Ring Reduce-Scatter | Full input per rank | n−1 rounds of S/n messages; rank j owns reduced chunk j; other workspace is explicitly not output |
| Ring All-Gather | Final gathered buffer | Initial per-rank chunk S/n; n−1 rounds; output ordered by source group index |
| Pairwise All-to-All | Full input per rank including local block | n−1 cyclic offsets; every ordered non-self pair receives S/n once; output ordered by source, without reduction |
| PP chain | One activation handoff | One S-byte transfer per neighboring stage, n−1 serial rounds; no stage computation |

Chunks are equal-sized; variable-length MoE dispatch belongs to the separate MoE
sandbox. PP is not a microbatch scheduler, throughput estimate or bubble model.
Tree is not double-tree/channel/pipelined NCCL. All singleton operations have
zero messages, bytes and latency.

Numerical witnesses are deliberately small: reduction input at group rank j and
chunk k is `(j+1)*(k+1)`; Gather's chunk k is k+1; A2A's source j to destination d
is `1000*(j+1)+(d+1)`; PP uses marker 1. They explain semantics, not real tensors.

## Byte accounting and hypothetical timing

Count sent payload bytes once, not sent+received. Cross-host bytes are the subset
whose endpoints occupy different hosts. Per-rank receive counts are a separate
diagnostic, not an additional total. S uses KiB (1024 bytes); GB/s is decimal.

For each round, accumulate directional bytes at local rank TX/RX, remote rank
TX/RX and shared host remote TX/RX. Each non-empty service budget costs
`alpha_us + bytes/(GB_per_s*1000)`. The maximum service time is the round duration;
sum rounds without overlap. Shared host traffic constrains the same network
messages; it is not charged twice. TX/RX are independent full-duplex budgets,
and local and remote paths are independent. Empty budgets add no startup.

No switch contention, multi-hop routing, packet scheduling, protocol overhead,
reduction compute, concurrent groups or framework overhead is modeled. The result
is a synchronous-round model estimate, not a lower bound or promised runtime.
Algorithm/placement cards keep all other applied parameters fixed and do not
claim that their fastest estimate wins on real hardware.

## Interaction, privacy and reliability

Results precede controls; mobile editing collapses. Drafts must be applied;
invalid drafts leave the current experiment intact. Strict versioned URLs reject
unknown/duplicate fields, invalid numbers and incompatible group/mode combinations.
Playback is finite, reader-controlled and independently scaled from estimated
microseconds. Pause, stepping and round jumps are available; reduced motion,
hidden pages, edits and pending route navigation stop playback. Pending query
changes disable stale controls. All participants remain keyboard accessible.

No data upload, storage, telemetry, API key or account is introduced. URL parameters
are public teaching inputs, not captured hardware state. Reload recomputes results.
The independent `config/communication-topology.json` build-time gate removes the
route/navigation after rebuilding; it does not clear existing local data.

## Source boundaries and companion

Collective semantics are grounded in the [NCCL collective reference](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html).
For benchmark bandwidth conventions, see [NCCL Tests performance documentation](https://github.com/NVIDIA/nccl-tests/blob/master/doc/PERFORMANCE.md).
The declared synchronous simulation and cost model above are this tool's own
teaching assumptions, not hardware measurements or claims made by those sources.

`public/diagrams/communication-topology.html` is an optional architecture companion
generated by Archify; its independent MIT notice is next to it. It explains a
directed A→B example through shared host links, not a complete collective trace.
It is a single responsive artifact with optional reader-controlled trace motion.
Private validation screenshots and machine-path receipts are kept outside the repo.
