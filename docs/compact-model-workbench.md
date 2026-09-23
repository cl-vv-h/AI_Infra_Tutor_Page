# Compact model workbench

## Reading hierarchy

The standard model explorer now starts with a small native React view in each tab:

- Structure: input → current attention / FFN → output. Parallel residual branches
  are marked as parallel, not represented as a sequential attention-to-MLP edge.
  mHC, AttnRes and multimodal branches have an explicit simplification note.
- Cache: workload and KV format alongside the logical capacity. Detailed state
  composition and formulas remain in a closed disclosure; budget inversion keeps
  its existing control.
- Weights: a sticky result strip, parallel controls and precision controls, with
  module totals alongside them on desktop. Individual formulas, stage totals,
  legacy rank exploration and native checkpoint auditing are separate disclosures.

The Archify project skill informed the primary-path / sparse-label / progressive-
disclosure design. `model-workbench.architecture.json` is the validated design
specification, **not** a model's inference DAG. The application uses native React
to retain live URL-backed precision and topology controls, rather than embedding
an independent static HTML viewer or downloading renderer code at runtime.

## Combined weight accounting

Public URL fields: `tp`, `ep`, `adp` (Attention DP), `pp`, `stage`, `replicas`.
Existing mixed precision and per-weight fields are unchanged. Old links default
to `adp=1`, `pp=1`, `stage=0`. Controls and parsing validate values; the UI exposes
PP sizes 1–16, bounded by the number of Decoder layers.

For this storage model:

- Each PP stage contains `tp` cards. Attention DP and EP divide those same cards;
  they are not extra multipliers in the world size.
- Attention projections use `attention_tp = tp / adp`. This includes separately
  modeled projection modules, norms, and KDA/GDN attention families. Replicated
  weights remain replicated according to their actual shape templates.
- Dense/shared FFNs use stage-wide TP. Routed experts split their expert axis
  by EP and intermediate dimension by `moe_tp = tp / ep`, never by TP and EP
  independently. All local experts remain resident, not only Top-k experts.
- PP partitions contiguous layers by count. Remainder layers go to the final
  stages. Every layer is counted with its own architecture and precision policy;
  a stage is not `total / pp` when its layers differ.
- `stage_bytes[s] = sum(layer_bytes[l] for l in stage s)`.
- `fleet_bytes = sum(stage_bytes) * tp * replicas`.
- `cards = tp * pp * replicas`. Independent replicas do not change local bytes.
- The selected layer's module table is independent of the observed stage. If that
  layer is not resident on the stage, an explicit message prevents confusing it
  with the current-card total.
- Layer-specific precision overrides affect only their owning stage. Payload,
  block/channel/global scales and existing static input scales use the current
  local matrix shape, including Attention TP.

Sources: pinned [SGLang PP partitioning](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/distributed/utils.py#L86),
[Attention DP](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/dp_attention.py),
and the existing audited `dpa-lab.ts` GLM-5.2 / Qwen3-8B reference.

## Boundaries

This is illustrated **Decoder storage**, not full checkpoint memory or evidence
that every model/backend supports a selected combined configuration. Embedding,
LM Head, vision tower, auxiliary layers, KV, activations, communication buffers,
allocator alignment and conversion peaks are excluded. PP custom partitions,
MoE-DP, A2A kernels, EPLB and redundant experts are not simulated.

The compact cache tab retains its original full-Decoder ordinary-TP baseline
(PP=1 / Attention DP=1) and states this next to its result. It must not be added
to the combined weight total as though both used the same placement. Logical
structure details also retain their ordinary-TP baseline. Legacy rank tools are
offered only when PP=1 / Attention DP=1. The Kimi native audit is explicitly a
separate PP=1 / no-DPA reference and does not inherit custom precision overrides.
DeepSeek-V4.1's separate native-reference route is unchanged; its complete-expert
placement must not be silently replaced by the standard SGLang-style calculator.

## Verification

`npm run test:models:deployment` checks balanced and remainder PP, catalogue-wide
baseline equivalence, DPA/EP combinations against the independently implemented
DPA reference, scale-inclusive single-layer overrides, non-local layers, replica
scaling and URL validation.

`npm run test:models:deployment:browser` checks 360/390/768/1440 px layouts,
sticky result visibility during precision edits, mixed EP/PP/ADP/replica controls,
URL reload, compact diagram inspection and cache interactions. Optional browser
setup uses the existing `MODEL_QA_PLAYWRIGHT`, `MODEL_QA_CHANNEL`, `MODEL_QA_BASE`
and `MODEL_QA_SCREENSHOTS` environment variables; no credentials are required.

The legacy full browser suite explicitly opens the new disclosures to continue
testing advanced tools. The compact suite separately checks collapsed defaults.

### Archify design receipt

- diagram_type: architecture
- specification: `model-workbench.architecture.json`
- specification_sha256: `e0ba62726ae7781d24886bc4905192097e16b78f59229edde754e3c07fce6886`
- artifact_sha256: `898c38b59beacc93f6dcf43364952b8285e4bed9206248ef8a1ea4632109b880`
- validation: 9/9 showcase, 0 errors, 0 warnings
- browser_evidence: passed (1440×900, 1600×1000, 1920×1080, 2048×1320)
- visual_review: passed (rendered light and dark endpoint screenshots inspected)
- correction_rounds: 2 (label clearance, then desktop vertical spacing)

The generated standalone design HTML and browser evidence are local QA artifacts,
not part of the website bundle. These checks do not constitute GPU/NPU inference
tests or deployment-feasibility validation.
