// Editorial decisions only. This module is not imported by the website.
// Keep source paths stable; the generated catalog supplies one record per material.
export const sourceRevision = '19be702f0842301583b6d84a98c9e42a9f9b35e5'
export const siteRevision = '668f9cd1867d9d6e3f27f8e97861af042d184caa'
export const auditedAt = '2026-10-30'
export const domains = [
  ['basics', '推理基础'], ['models', '模型架构与状态机制'],
  ['runtime', 'Serving 运行时与缓存管理'], ['distributed', '分布式并行与通信'],
  ['optimization', '推理加速与高效服务'], ['validation', '性能评测、Profiling 与正确性'],
  ['ascend', 'Ascend 平台实践'], ['kernels', '算子编程与编译'],
].map(([id, title]) => ({ id, title }))

// Prerequisites are editorial recommendations at topic level, not runtime gates.
export const topics = [
  ['orientation', 'basics', '课程总览', []],
  ['inference', 'basics', 'Prefill、Decode 与生成流程', []],
  ['transformer', 'models', 'Decoder-only Transformer', ['inference']],
  ['attention', 'models', 'MHA / MQA / GQA / MLA', ['transformer']],
  ['sparse-attention', 'models', 'DSA、CSA/HCA 与稀疏检索', ['attention']],
  ['gdn', 'models', 'Gated DeltaNet', ['transformer']],
  ['kda', 'models', 'Kimi Delta Attention', ['gdn']],
  ['mamba', 'models', 'Mamba 与状态空间模型', ['inference']],
  ['moe', 'models', 'MoE 专家选择与计算', ['transformer']],
  ['residual', 'models', 'mHC 与残差结构', ['transformer']],
  ['families', 'models', '模型架构谱系与多模态', ['transformer']],
  ['source-map', 'runtime', '源码阅读方法与组件地图', ['inference']],
  ['request', 'runtime', '请求生命周期与进程入口', ['inference']],
  ['scheduler', 'runtime', '调度、Batching 与 Overlap', ['request']],
  ['execution', 'runtime', 'Worker、ModelRunner 与 ForwardBatch', ['scheduler', 'transformer']],
  ['loading', 'runtime', '模型注册、权重加载与布局', ['transformer', 'source-map']],
  ['cache', 'runtime', 'KV Pool、分页、Prefix Cache 与 HiCache', ['attention']],
  ['hybrid-cache', 'runtime', 'Recurrent / Hybrid State 生命周期', ['cache', 'mamba']],
  ['service-router', 'runtime', '服务路由与 Worker 管理', ['request']],
  ['communication', 'distributed', '通信原语、链路与通信库', ['inference']],
  ['parallel', 'distributed', 'TP / PP / DP / EP 与 Rank 拓扑', ['transformer', 'communication']],
  ['attention-dp', 'distributed', 'Attention DP 与层边界通信', ['parallel', 'execution']],
  ['context-parallel', 'distributed', 'SP、Prefill CP 与 Decode CP', ['parallel', 'cache']],
  ['expert-parallel', 'distributed', 'MoE Dispatch / Combine、DeepEP 与 DWDP', ['parallel', 'moe']],
  ['pd-transfer', 'distributed', 'PD 分离与 KV Transfer', ['parallel', 'cache']],
  ['diffusion-parallel', 'distributed', 'Diffusion 并行扩展', ['parallel']],
  ['attention-kernel', 'optimization', 'FlashAttention、FlashDecoding 与 Online Softmax', ['attention']],
  ['graph', 'optimization', '执行图、Capture / Replay 与编译', ['execution']],
  ['quantization', 'optimization', '量化数学、格式、算法与 Serving', ['transformer']],
  ['speculation', 'optimization', '投机采样、验证与状态提交', ['inference', 'cache']],
  ['dspark', 'optimization', 'DSpark 与半自回归执行', ['speculation', 'execution']],
  ['lora', 'optimization', 'LoRA 原理与多 Adapter Serving', ['transformer']],
  ['benchmark', 'validation', '指标、Baseline 与 Workload', ['inference']],
  ['profiling', 'validation', 'Trace、瓶颈归因与实验验证', ['benchmark', 'execution']],
  ['accuracy', 'validation', 'Reference、精度评测与二分定位', ['benchmark', 'loading']],
  ['ascend-stack', 'ascend', 'Ascend 软件栈与版本边界', ['inference']],
  ['ascend-serving', 'ascend', '环境、最小服务与部署场景', ['ascend-stack', 'benchmark']],
  ['ascend-integration', 'ascend', 'NPU 接入、Backend 与参数', ['ascend-stack', 'execution']],
  ['kernel-foundations', 'kernels', 'Host / Device、类型、硬件、存储与流水', ['ascend-stack']],
  ['triton', 'kernels', 'Triton-Ascend 编程与编译', ['kernel-foundations']],
  ['ascend-c', 'kernels', 'Ascend C、Tiling 与 Workspace', ['kernel-foundations']],
  ['custom-op', 'kernels', 'torch_npu、ACLNN 与 Custom Op', ['kernel-foundations']],
  ['kernel-cases', 'kernels', '真实算子与通信 Kernel 源码', ['custom-op']],
  ['case-glm47', 'models', 'GLM-4.7-Flash 综合案例', ['attention', 'moe', 'execution', 'cache']],
  ['case-qwen35', 'models', 'Qwen3.5 Hybrid 综合案例', ['gdn', 'execution', 'cache']],
  ['case-glm52', 'models', 'GLM-5.2 综合案例', ['sparse-attention', 'moe', 'execution']],
  ['case-glm53', 'models', 'GLM-5.3-Flash 综合案例', ['kda', 'sparse-attention', 'residual', 'moe', 'execution']],
].map(([id, domainId, title, prerequisites]) => ({ id, domainId, title, prerequisites }))

// Exact groups are intentionally exhaustive. A new source file must be classified;
// it must not silently inherit an unrelated folder's topic or difficulty.
const assignments = []
function group(prefix, topicId, layer, difficulty, platformScope, paths) {
  for (const path of paths.split('\n').map(value => value.trim()).filter(Boolean)) {
    assignments.push({ sourcePath: `${prefix}${path}`, topicId, layer, difficulty, platformScope })
  }
}
const basic = 'ai-infra-basic/'
group('', 'orientation', 'overview', 'introductory', ['general'], 'README.md\nai-infra-basic/README.md')
group(basic, 'inference', 'principles', 'introductory', ['general'], 'Inference_Basics/README.md')
group(basic, 'transformer', 'principles', 'introductory', ['general'], 'Model_Architecture/01-decoder-only-transformer.md')
group(basic, 'families', 'overview', 'intermediate', ['general'], 'Model_Architecture/README.md\nModel_Architecture/05-architecture-families.md')
group(basic, 'attention', 'principles', 'intermediate', ['general'], 'Model_Architecture/02-gqa-attention-shapes.md\nModel_Architecture/04-multi-head-latent-attention.md\nModel_Architecture/06-efficient-attention-landscape.md')
group(basic, 'sparse-attention', 'principles', 'advanced', ['general'], 'Model_Architecture/07-deepseek-sparse-attention.md\nModel_Architecture/08-compressed-sparse-attention.md')
group(basic, 'moe', 'principles', 'intermediate', ['general'], 'Model_Architecture/03-sparse-moe-routing.md')
group(basic, 'kda', 'principles', 'advanced', ['general'], 'Model_Architecture/09-kimi-delta-attention.md')
group(basic, 'residual', 'principles', 'advanced', ['general'], 'Model_Architecture/10-manifold-constrained-hyper-connections.md')
group(basic, 'residual', 'experiment', 'advanced', ['cpu'], 'Model_Architecture/mhc_principles_demo.py')
group(basic, 'gdn', 'principles', 'advanced', ['general'], 'Gated_Delta_Network/README.md\nGated_Delta_Network/01-gdn-math-and-state.md\nGated_Delta_Network/02-gdn-layer-dataflow-and-shapes.md')
group(basic, 'gdn', 'runtime', 'advanced', ['general'], 'Gated_Delta_Network/03-gdn-training-and-serving.md')
group(basic, 'mamba', 'principles', 'advanced', ['general'], 'Mamba_State_Space/README.md\nMamba_State_Space/02-mamba-principles.md')
group(basic, 'hybrid-cache', 'runtime', 'advanced', ['general'], 'Mamba_State_Space/01-mamba-and-sglang-state.md\nMamba_State_Space/03-mamba-radix-cache.md')
group(basic, 'scheduler', 'principles', 'introductory', ['general'], 'Schedule_Optimization/README.md')
group(basic, 'scheduler', 'experiment', 'introductory', ['python'], 'Schedule_Optimization/prefill_decode_demo.py\nSchedule_Optimization/chunked_prefill_with_fakeLLM_tutorial.py')
group(basic, 'cache', 'principles', 'introductory', ['general'], 'KV_Cache_Memory/README.md')
group(basic, 'attention-kernel', 'overview', 'intermediate', ['general'], 'Attention_Kernel/README.md')
group(basic, 'attention-kernel', 'experiment', 'intermediate', ['pytorch'], 'Attention_Kernel/flash_attention_tutorial.py\nAttention_Kernel/flash_decoding_tutorial.py')
group(basic, 'graph', 'principles', 'intermediate', ['general', 'cuda', 'ascend'], 'Execution_Graph/README.md\nExecution_Graph/01-what-is-graph.md')
group(basic, 'graph', 'runtime', 'advanced', ['general', 'cuda', 'ascend'], 'Execution_Graph/02-graph-execution-dataflow.md')
group(basic, 'parallel', 'overview', 'intermediate', ['general'], 'Parallel_Strategy/README.md\nParallel_Strategy/00-parallelism-map-and-version-boundaries.md')
group(basic, 'parallel', 'principles', 'intermediate', ['general'], 'Parallel_Strategy/tutorial.md\nParallel_Strategy/06-parallel-topology-and-pd-composition.md\nParallel_Strategy/07-encoder-dp-and-elastic-ep.md')
group(basic, 'attention-dp', 'principles', 'advanced', ['general'], 'Parallel_Strategy/01-dp-attention-principles.md')
group(basic, 'context-parallel', 'principles', 'advanced', ['general'], 'Parallel_Strategy/02-sp-versus-context-parallelism.md\nParallel_Strategy/03-prefill-context-parallelism.md\nParallel_Strategy/04-decode-context-parallelism.md')
group(basic, 'expert-parallel', 'principles', 'advanced', ['general'], 'Parallel_Strategy/05-dwdp-weight-parallelism.md')
group(basic, 'diffusion-parallel', 'principles', 'advanced', ['general'], 'Parallel_Strategy/08-diffusion-parallelism.md')
group(basic, 'parallel', 'experiment', 'intermediate', ['pytorch', 'distributed'], 'Parallel_Strategy/dp_inference_demo.py\nParallel_Strategy/tp_inference_demo.py\nParallel_Strategy/pp_inference_demo.py')
group(basic, 'expert-parallel', 'experiment', 'intermediate', ['pytorch', 'distributed'], 'Parallel_Strategy/ep_moe_demo.py')
group(basic, 'context-parallel', 'experiment', 'advanced', ['pytorch', 'distributed'], 'Parallel_Strategy/sp_inference_demo.py')
group(basic, 'parallel', 'experiment', 'advanced', ['cpu'], 'Parallel_Strategy/parallelism_math_demo.py')
group(basic, 'attention-dp', 'experiment', 'advanced', ['cpu'], 'Parallel_Strategy/dp_attention_layout_demo.py')
group(basic, 'context-parallel', 'experiment', 'advanced', ['cpu'], 'Parallel_Strategy/sp_step_by_step_demo.py\nParallel_Strategy/pcp_query_rows_demo.py\nParallel_Strategy/dcp_cache_address_demo.py')
group(basic, 'communication', 'principles', 'intermediate', ['general'], 'Communication/README.md\nCommunication/01-communication-primitives-and-costs.md\nCommunication/02-links-rdma-and-memory.md\nCommunication/03-collective-libraries-gloo-nccl-hccl.md')
group(basic, 'expert-parallel', 'principles', 'advanced', ['general'], 'Communication/04-moe-deepep-and-zbal.md')
group(basic, 'expert-parallel', 'runtime', 'advanced', ['ascend'], 'Communication/07-zbal-zero-buffer-source-dataflow.md')
group(basic, 'pd-transfer', 'principles', 'intermediate', ['general'], 'Communication/05-kv-transfer-mooncake-and-nixl.md\nKV_Transfer/README.md')
group(basic, 'communication', 'runtime', 'advanced', ['general'], 'Communication/06-sglang-paths-and-performance.md')
group(basic, 'communication', 'experiment', 'intermediate', ['cpu'], 'Communication/communication_semantics_demo.py')
group(basic, 'quantization', 'principles', 'intermediate', ['general'], 'Quantization/README.md\nQuantization/01-quantization-foundations.md\nQuantization/02-bitwidth-formats-and-packing.md\nQuantization/03-weight-quantization-algorithms.md\nQuantization/04-activation-kv-fp8-quantization.md')
group(basic, 'quantization', 'runtime', 'advanced', ['general'], 'Quantization/05-serving-kernel-and-debugging.md')
group(basic, 'speculation', 'principles', 'advanced', ['general'], 'Speculative_Decoding/README.md\nSpeculative_Decoding/01-speculative-decoding-principles.md\nSpeculative_Decoding/02-rejection-sampling-math.md\nSpeculative_Decoding/04-algorithm-landscape.md')
group(basic, 'speculation', 'runtime', 'advanced', ['general'], 'Speculative_Decoding/03-serving-implementation-dataflow.md')
group(basic, 'dspark', 'principles', 'advanced', ['general'], 'Speculative_Decoding/05-dspark-principles.md')
group(basic, 'lora', 'overview', 'intermediate', ['general'], 'LoRA/README.md')
group(basic, 'lora', 'experiment', 'intermediate', ['pytorch'], 'LoRA/lora_tutorial.py\nLoRA/qlora_tutorial.py\nLoRA/dora_tutorial.py\nLoRA/adalora_tutorial.py')
group(basic, 'benchmark', 'principles', 'introductory', ['general'], 'Benchmark_Profiling/README.md')

const source = 'sglang-source-reading/'
group(source, 'source-map', 'overview', 'intermediate', ['general'], 'README.md\n00-overview/00-feature-map.md\n00-overview/01-public-components-code-walkthrough.md')
group(source, 'request', 'runtime', 'intermediate', ['general'], '01-entry-routing/01-request-lifecycle.md')
group(source, 'service-router', 'runtime', 'advanced', ['general'], '01-entry-routing/09-router.md\n01-entry-routing/10-sgl-router-source-deep-dive.md')
group(source, 'scheduler', 'runtime', 'intermediate', ['general'], '02-scheduler-runtime/02-scheduler-core.md')
group(source, 'parallel', 'runtime', 'advanced', ['general'], '02-scheduler-runtime/06-multiprocess-distributed.md')
group(source, 'cache', 'runtime', 'intermediate', ['general'], '03-cache-memory/03-kv-cache-radix-cache.md')
group(source, 'execution', 'runtime', 'intermediate', ['general'], '04-model-execution/04-model-runner-attention.md')
group(source, 'attention-dp', 'runtime', 'advanced', ['general'], '05-layer-communication/01-layer-communicator-and-common-layers.md\n05-layer-communication/03-dp-attention-code-walkthrough.md')
group(source, 'parallel', 'runtime', 'advanced', ['general', 'ascend'], '05-layer-communication/02-tp-dp-ep-sharding-and-ascend-npu.md')
group(source, 'context-parallel', 'runtime', 'advanced', ['general', 'ascend'], '05-layer-communication/04-prefill-context-parallel-code-walkthrough.md')
group(source, 'context-parallel', 'experiment', 'advanced', ['cpu'], '05-layer-communication/pcp_layout_trace_demo.py')
group(source, 'speculation', 'runtime', 'advanced', ['general'], '06-advanced-features/05-speculative-decoding.md')
group(source, 'pd-transfer', 'runtime', 'advanced', ['general'], '06-advanced-features/07-disaggregation-pd.md')
group(source, 'lora', 'runtime', 'advanced', ['general'], '06-advanced-features/08-lora-serving.md')
group(source, 'dspark', 'runtime', 'advanced', ['general'], '06-advanced-features/09-dspark-code-walkthrough.md')
group('scheduler-architecture/', 'scheduler', 'runtime', 'intermediate', ['general'], 'README.md\n01-architecture.md\n02-flowcharts.md\n03-annotated-code-walkthrough.md')
group('scheduler-architecture/', 'scheduler', 'reference', 'advanced', ['general'], '04-function-map.md\n05-scheduler-annotated-cn.py')
group('tp-worker-model-runner/', 'execution', 'runtime', 'intermediate', ['general'], 'README.md\n01-architecture.md\n02-flowcharts.md')
group('tp-worker-model-runner/', 'execution', 'reference', 'advanced', ['general'], '03-function-map.md\n04-tp-worker-annotated-cn.py\n05-model-runner-annotated-cn.py')
group('tp-worker-model-runner/', 'loading', 'runtime', 'intermediate', ['general'], '06-model-loading-and-architecture-resolution.md')

const npu = 'sglang-ascend-npu/'
group(npu, 'ascend-stack', 'overview', 'introductory', ['ascend'], 'README.md\n00-background.md')
group(npu, 'ascend-serving', 'platform', 'intermediate', ['ascend'], '01-environment-and-install.md\n03-launch-and-minimal-serving.md\n13-run-models-by-scenario.md')
group(npu, 'ascend-integration', 'platform', 'advanced', ['ascend'], '02-ascend-npu-integration-map.md\n04-npu-backend-args.md\n09-lora-moe-feature-branches.md')
group(npu, 'cache', 'platform', 'advanced', ['ascend'], '05-attention-kv-cache.md')
group(npu, 'graph', 'platform', 'advanced', ['ascend'], '06-npu-graph-compilation.md\nsource-code-walkthrough/05-npu-graph-and-compilation.md')
group(npu, 'parallel', 'platform', 'intermediate', ['ascend'], '07-distributed-hccl-tp.md')
group(npu, 'pd-transfer', 'platform', 'advanced', ['ascend'], '08-ascend-pd-disaggregation.md')
group(npu, 'benchmark', 'platform', 'intermediate', ['ascend'], '10-benchmark-debugging.md\n14-performance-testing.md')
group(npu, 'profiling', 'platform', 'advanced', ['ascend'], '11-performance-optimization-work-map.md\n12-npu-profiling-guide.md')
group(npu, 'accuracy', 'platform', 'advanced', ['ascend'], '15-accuracy-testing-and-debugging.md')
group(npu, 'ascend-integration', 'overview', 'advanced', ['ascend'], 'source-code-walkthrough/README.md\nsource-code-walkthrough/01-sglang-npu-component-map.md')
group(npu, 'attention-dp', 'platform', 'advanced', ['ascend'], 'source-code-walkthrough/15-distributed-hccl-and-communication.md')
group(npu, 'source-map', 'reference', 'intermediate', ['ascend'], 'source-code-walkthrough/foundation/00-reading-method-and-branch-search.md')
group(npu, 'ascend-integration', 'platform', 'intermediate', ['ascend'], 'source-code-walkthrough/foundation/01-platform-detection-and-process-startup.md\nsource-code-walkthrough/foundation/02-server-args-and-npu-defaults.md')
group(npu, 'request', 'platform', 'intermediate', ['ascend'], 'source-code-walkthrough/foundation/03-request-lifecycle-npu-branch-points.md')
group(npu, 'loading', 'platform', 'advanced', ['ascend'], 'source-code-walkthrough/foundation/04-model-loading-dtype-and-layout.md')
group(npu, 'execution', 'platform', 'advanced', ['ascend'], 'source-code-walkthrough/foundation/05-model-runner-forward-batch-and-input-buffers.md')
for (const [name, topic] of [['00-glm-4.7-flash','case-glm47'], ['01-qwen3.5-hybrid','case-qwen35'], ['02-glm-5.2','case-glm52'], ['03-glm-5.3-flash','case-glm53']]) {
  group(`${npu}source-code-walkthrough/examples/`, topic, 'case-study', 'advanced', ['general', 'ascend'], `${name}-end-to-end.md`)
}
group(npu, 'case-glm53', 'experiment', 'advanced', ['cpu'], 'source-code-walkthrough/examples/glm53_flash_shape_demo.py')
const atlas = `${npu}source-code-walkthrough/assets/glm-5.3-flash/architecture/`
group(atlas, 'case-glm53', 'reference', 'advanced', ['general'], 'README.md\nlicenses/THIRD_PARTY_NOTICES.md')
group(atlas, 'case-glm53', 'visualization', 'advanced', ['browser'], '01-model-overview.html\n02-decoder-layer.html\n03-kda-internals.html\n04-dsa-mla-internals.html\n05-ffn-moe-internals.html\n06-vision-internals.html')

const kernel = 'ascend-kernel-infra/'
group(kernel, 'kernel-foundations', 'overview', 'intermediate', ['ascend'], 'README.md\nROADMAP.md')
group(kernel, 'ascend-stack', 'principles', 'intermediate', ['ascend'], '01-stack-and-relationships.md\n02-cann-stack-and-boundaries.md')
group(kernel, 'kernel-foundations', 'principles', 'intermediate', ['ascend'], 'foundations/01-kernel-first-principles.md\nfoundations/02-ascend-hardware.md\nfoundations/03-memory-pipeline-and-sync.md')
group(kernel, 'kernel-foundations', 'reference', 'intermediate', ['ascend'], 'reference/code-reading-and-types.md\nreference/glossary.md\nreference/technology-comparison.md')
group(kernel, 'triton', 'platform', 'advanced', ['ascend'], 'triton-ascend/01-program-grid-tile.md\ntriton-ascend/02-tensor-addressing-reduction-matmul.md\ntriton-ascend/03-compile-debug-optimize.md\ntriton-ascend/04-ttir-mlir-driver-and-cache.md\ntriton-ascend/05-persistent-kernel-and-large-grid.md')
group(kernel, 'ascend-c', 'platform', 'advanced', ['ascend'], 'ascend-c/01-global-local-tensor-pipe-queue.md\nascend-c/02-add-operator-end-to-end.md\nascend-c/03-tiling-pipeline-sync-optimization.md\nascend-c/04-platform-tiling-and-workspace-contracts.md')
group(kernel, 'custom-op', 'platform', 'advanced', ['ascend'], 'torch_npu/01-dispatch-aclnn-and-custom-op-boundaries.md\nsgl-kernel-npu/01-repository-and-op-lifecycle.md')
group(kernel, 'graph', 'platform', 'advanced', ['ascend'], 'torch_npu/02-stream-events-and-graph-capture.md')
group(kernel, 'kernel-cases', 'platform', 'advanced', ['ascend'], 'sgl-kernel-npu/02-triton-fused-split-qk-norm.md\nsgl-kernel-npu/03-ascend-c-apply-token-bitmask.md\nsgl-kernel-npu/04-fla-chunk-gated-delta-rule-mixed-path.md\nsgl-kernel-npu/05-deepep-hccl-and-moe-kernel-path.md\nsgl-kernel-npu/06-deepep-low-latency-and-layered-a2-path.md\nsgl-kernel-npu/08-fla-mega-kernel-device-stages.md')
export { assignments }

export const titleOverrides = {
  'Parallel_Strategy/sp_inference_demo.py': 'CP 分布式 Softmax 实验（历史文件名含 SP）',
  'Parallel_Strategy/sp_step_by_step_demo.py': 'TP + SP 的逐步数值实验',
  'Parallel_Strategy/pcp_query_rows_demo.py': 'PCP Query 行分配与因果关系实验',
  'Parallel_Strategy/dcp_cache_address_demo.py': 'DCP 缓存地址映射实验',
  'Parallel_Strategy/parallelism_math_demo.py': '组合并行数学等价性实验',
  'Parallel_Strategy/dp_attention_layout_demo.py': 'DP Attention 布局与去重实验',
  'Parallel_Strategy/dp_inference_demo.py': 'DP 推理教学代码',
  'Parallel_Strategy/tp_inference_demo.py': 'TP 推理教学代码',
  'Parallel_Strategy/pp_inference_demo.py': 'PP 推理教学代码',
  'Parallel_Strategy/ep_moe_demo.py': 'EP 专家分发与合并教学代码',
  'Attention_Kernel/flash_attention_tutorial.py': 'FlashAttention 教学实现',
  'Attention_Kernel/flash_decoding_tutorial.py': 'FlashDecoding 教学实现',
  'LoRA/lora_tutorial.py': 'LoRA 教学代码', 'LoRA/qlora_tutorial.py': 'QLoRA 教学代码',
  'LoRA/dora_tutorial.py': 'DoRA 教学代码', 'LoRA/adalora_tutorial.py': 'AdaLoRA 教学代码',
  'Schedule_Optimization/prefill_decode_demo.py': 'Prefill / Decode 调度实验',
  'Schedule_Optimization/chunked_prefill_with_fakeLLM_tutorial.py': 'Chunked Prefill 模拟实验',
  'Model_Architecture/mhc_principles_demo.py': 'mHC 数学原理实验',
  'Communication/communication_semantics_demo.py': '通信原语语义实验',
  'scheduler-architecture/05-scheduler-annotated-cn.py': 'Scheduler 中文注释源码',
  'tp-worker-model-runner/04-tp-worker-annotated-cn.py': 'TpModelWorker 中文注释源码',
  'tp-worker-model-runner/05-model-runner-annotated-cn.py': 'ModelRunner 中文注释源码',
  '05-layer-communication/pcp_layout_trace_demo.py': 'PCP CPU 布局追踪实验',
  'examples/glm53_flash_shape_demo.py': 'GLM-5.3-Flash CPU Shape 自检',
}

export const editorialOverrides = {
  [`${basic}Parallel_Strategy/sp_inference_demo.py`]: { notes: ['内容是 CP 分布式 softmax，不能按历史文件名误归为 LayerNorm SP。'] },
  [`${source}01-entry-routing/09-router.md`]: { relatedTopics: ['moe'], actions: ['split-service-and-expert-routing'], notes: ['服务 Router 与 MoE Router 分开归类；迁移前保留全文和原锚点。'] },
  [`${basic}Gated_Delta_Network/03-gdn-training-and-serving.md`]: { relatedTopics: ['cache', 'speculation'] },
  [`${basic}Model_Architecture/06-efficient-attention-landscape.md`]: { layer: 'overview', relatedTopics: ['sparse-attention', 'gdn', 'kda', 'attention-kernel'] },
  [`${basic}README.md`]: { actions: ['repair-demo-paths'], notes: ['运行示例中的 learning/ai-infra-basic 路径缺少 zh/；本轮仅记录，不修改原文。'] },
  [`${kernel}ROADMAP.md`]: { role: 'maintenance', notes: ['课程规划不是教学正文。'] },
  [`${atlas}licenses/THIRD_PARTY_NOTICES.md`]: { role: 'license', notes: ['保留许可证，不生成独立课程入口。'] },
  [`${atlas}README.md`]: { role: 'resource-index' },
  [`${kernel}torch_npu/02-stream-events-and-graph-capture.md`]: { prerequisites: ['custom-op', 'execution'], relatedTopics: ['profiling'], notes: ['同主题内先读 Execution_Graph/01-what-is-graph.md，再进入 Stream/Event 与设备内存生命周期。'] },
  [`${kernel}sgl-kernel-npu/02-triton-fused-split-qk-norm.md`]: { prerequisites: ['custom-op', 'triton'] },
  [`${kernel}sgl-kernel-npu/03-ascend-c-apply-token-bitmask.md`]: { prerequisites: ['custom-op', 'ascend-c'] },
  [`${kernel}sgl-kernel-npu/04-fla-chunk-gated-delta-rule-mixed-path.md`]: { prerequisites: ['custom-op', 'triton', 'ascend-c', 'gdn'] },
  [`${kernel}sgl-kernel-npu/05-deepep-hccl-and-moe-kernel-path.md`]: { prerequisites: ['custom-op', 'expert-parallel', 'ascend-c'] },
  [`${kernel}sgl-kernel-npu/06-deepep-low-latency-and-layered-a2-path.md`]: { prerequisites: ['custom-op', 'expert-parallel', 'ascend-c'] },
  [`${kernel}sgl-kernel-npu/08-fla-mega-kernel-device-stages.md`]: { prerequisites: ['custom-op', 'triton', 'ascend-c', 'gdn'] },
  [`${npu}source-code-walkthrough/examples/03-glm-5.3-flash-end-to-end.md`]: { notes: ['正文区分仓内旧快照与固定上游模型实现；CPU 数学验证不等于整模型 GPU/NPU 实测。'] },
}

export const planned = [
  ['02-platform-runtime-and-kernel-bootstrap.md', 'ascend-integration', '平台与运行时接入'],
  ['03-ascend-attention-and-mla.md', 'attention', 'Ascend Attention / MLA'],
  ['04-kv-cache-memory-and-allocator.md', 'cache', 'KV Cache 与 Allocator'],
  ['06-norm-rope-and-activation.md', 'kernel-cases', 'Norm / RoPE / Activation'],
  ['07-quantization-and-linear.md', 'quantization', '量化与 Linear'],
  ['08-moe-routing-and-fused-expert.md', 'moe', 'MoE 计算与融合专家'],
  ['09-deepep-ascend-and-expert-parallel.md', 'expert-parallel', 'DeepEP-Ascend 与 EP'],
  ['10-ascend-lora.md', 'lora', 'Ascend LoRA'],
  ['11-fla-mamba-and-hybrid-linear-attention.md', 'hybrid-cache', 'FLA / Mamba / Hybrid'],
  ['12-speculative-decoding.md', 'speculation', 'Ascend 投机解码'],
  ['13-sampling-and-constrained-decoding.md', 'request', '采样与约束解码'],
  ['14-model-specific-and-multimodal-components.md', 'families', '模型与多模态适配'],
  ['16-pd-disaggregation-and-kv-transfer.md', 'pd-transfer', 'Ascend PD 与 KV 传输'],
  ['17-utility-kernels-and-memory-optimization.md', 'kernel-cases', '工具算子与内存优化'],
  ['18-build-registration-tests-and-cross-repo-development.md', 'custom-op', '构建、注册与双仓验证'],
].map(([name, topicId, title]) => ({ sourcePath: `${npu}source-code-walkthrough/${name}`, topicId, title, evidencePath: `${npu}source-code-walkthrough/README.md`, status: 'planned-file-absent' }))
planned.push({ sourcePath: `${kernel}sgl-kernel-npu/07-deepep-fused-moe-and-dispatch-ffn-combine.md`, topicId: 'kernel-cases', title: 'DeepEP Fused MoE', evidencePath: `${kernel}ROADMAP.md`, status: 'planned-file-absent' })

const step = (path, goal, section = null) => ({ sourcePath: path, goal, section })
export const learningPaths = [
  { id: 'inference-foundations', title: '理解大模型推理', entryRequirements: '能阅读基础 Python 和矩阵维度；不要求设备环境。', outcome: '解释一次请求的计算、状态与主要开销。', steps: [
    step(`${basic}Inference_Basics/README.md`, '区分 Prefill、Decode 与自回归循环'),
    step(`${basic}Model_Architecture/01-decoder-only-transformer.md`, '识别 Decoder 的计算模块'),
    step(`${basic}Model_Architecture/02-gqa-attention-shapes.md`, '追踪 Q/K/V 与缓存形状'),
    step(`${basic}KV_Cache_Memory/README.md`, '解释缓存容量、分页与复用'),
    step(`${basic}Benchmark_Profiling/README.md`, '先建立 TTFT / ITL / TPS 指标语言'),
    step(`${basic}Schedule_Optimization/README.md`, '理解 Batching 与调度权衡'),
    step(`${source}01-entry-routing/01-request-lifecycle.md`, '把模型计算放回一次请求'),
  ], optional: [step(`${basic}Schedule_Optimization/prefill_decode_demo.py`, '观察简化调度过程')] },
  { id: 'sglang-development', title: '阅读和修改 SGLang', entryRequirements: '完成推理基础路线；能阅读 Python 类和函数调用。', outcome: '从问题定位组件、状态和代码入口。', steps: [
    step(`${source}00-overview/01-public-components-code-walkthrough.md`, '先识别公共组件'),
    step(`${source}01-entry-routing/01-request-lifecycle.md`, '跟随请求主链路'),
    step('scheduler-architecture/01-architecture.md', '理解调度器职责与状态'),
    step('scheduler-architecture/02-flowcharts.md', '区分启动、调度和执行流程'),
    step('tp-worker-model-runner/01-architecture.md', '区分 Worker 与 ModelRunner'),
    step('tp-worker-model-runner/06-model-loading-and-architecture-resolution.md', '追踪模型类解析与权重加载'),
    step(`${source}04-model-execution/04-model-runner-attention.md`, '追踪 Backend 与 ForwardBatch'),
    step(`${source}03-cache-memory/03-kv-cache-radix-cache.md`, '定位缓存分配与复用'),
  ], optional: [step('scheduler-architecture/04-function-map.md', '按问题查函数'), step(`${source}06-advanced-features/05-speculative-decoding.md`, '按需进入高级特性')] },
  { id: 'deployment-performance', title: '部署与性能优化（Ascend 实践分支）', entryRequirements: '掌握推理基础；设备实验需另行准备匹配版本的 Ascend 环境。', outcome: '用可比较实验解释收益、精度变化和平台限制。', steps: [
    step(`${npu}00-background.md`, '理解平台栈与边界'),
    step(`${npu}03-launch-and-minimal-serving.md`, '按环境完成最小服务验收'),
    step(`${basic}Benchmark_Profiling/README.md`, '定义指标与工作负载'),
    step(`${npu}14-performance-testing.md`, '记录 Baseline 与实验条件'),
    step(`${npu}12-npu-profiling-guide.md`, '定位调度、计算、访存和通信瓶颈'),
    step(`${npu}11-performance-optimization-work-map.md`, '由证据选择一个优化方向'),
    step(`${npu}15-accuracy-testing-and-debugging.md`, '复验精度并二分定位异常'),
  ], optional: [step(`${basic}Parallel_Strategy/README.md`, '多卡方向'), step(`${basic}Quantization/README.md`, '量化方向'), step(`${basic}Execution_Graph/README.md`, 'Graph 方向'), step(`${basic}KV_Transfer/README.md`, 'PD 方向')] },
  { id: 'ascend-kernels', title: 'Ascend 算子开发', entryRequirements: '能读 Python/C++ 与基本张量运算；理论阅读不要求设备，运行需 CANN/NPU。', outcome: '追踪 Host / Device 契约，并设计正确性与性能验证。', steps: [
    step(`${kernel}01-stack-and-relationships.md`, '分清软件栈职责'),
    step(`${kernel}02-cann-stack-and-boundaries.md`, '定位 CANN 与运行时边界'),
    step(`${kernel}foundations/01-kernel-first-principles.md`, '掌握 Grid、Tile、Host / Device'),
    step(`${kernel}foundations/02-ascend-hardware.md`, '理解硬件与存储层级'),
    step(`${kernel}foundations/03-memory-pipeline-and-sync.md`, '理解搬运、计算与同步'),
    step(`${kernel}reference/code-reading-and-types.md`, '查阅类型与地址单位', '作为工具书，按例子查阅'),
    step(`${kernel}sgl-kernel-npu/01-repository-and-op-lifecycle.md`, '定位算子工程的入口与生命周期'),
  ], branches: [
    { title: 'Triton-Ascend 分支', steps: [step(`${kernel}triton-ascend/01-program-grid-tile.md`, '编写 Grid / Tile'), step(`${kernel}triton-ascend/02-tensor-addressing-reduction-matmul.md`, '理解地址、归约和矩阵乘'), step(`${kernel}triton-ascend/03-compile-debug-optimize.md`, '学习编译、调试与验证'), step(`${kernel}torch_npu/01-dispatch-aclnn-and-custom-op-boundaries.md`, '定位注册与调用边界'), step(`${kernel}sgl-kernel-npu/02-triton-fused-split-qk-norm.md`, '阅读真实融合算子')] },
    { title: 'Ascend C 分支', steps: [step(`${kernel}ascend-c/01-global-local-tensor-pipe-queue.md`, '学习 Tensor、Pipe 与 Queue'), step(`${kernel}ascend-c/02-add-operator-end-to-end.md`, '串起最小算子端到端链路'), step(`${kernel}ascend-c/03-tiling-pipeline-sync-optimization.md`, '分析 Tiling 与流水'), step(`${kernel}torch_npu/01-dispatch-aclnn-and-custom-op-boundaries.md`, '定位注册与调用边界'), step(`${kernel}sgl-kernel-npu/03-ascend-c-apply-token-bitmask.md`, '阅读真实约束采样算子')] },
  ], optional: [] },
]
