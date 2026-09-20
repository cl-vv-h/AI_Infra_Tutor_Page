/** Editorial analysis dimensions, not generated conclusions about any article. */
export const newsStudyGuides: Record<string, { title: string; points: string[]; links: Array<{ label: string; to: string }>; originals?: Array<{ label: string; url: string }> }> = {
  inference: {
    title: '把吞吐数字放回真实请求中',
    points: ["指标：TTFT、ITL、吞吐与延迟约束。","负载：输入 / 输出长度、并发与前缀命中率。","优化范围：调度、KV 管理与模型执行。"],
    links: [{ label: '推理指标与阶段', to: '/category/inference-basics' }, { label: 'KV Cache 与显存', to: '/category/kv-cache-memory' }, { label: 'SGLang 源码路线', to: '/category/sglang' }],
    originals: [{ label: 'SGLang 官方技术博客', url: 'https://www.sglang.io/blog' }],
  },
  kernels: {
    title: '从单算子收益追到整网收益',
    points: ["适用条件：Shape、数据类型与硬件。","计时范围：编译、预热、同步与数据搬运。","证据范围：单算子微基准与端到端服务。"],
    links: [{ label: 'Decode 算法', to: '/category/decode' }, { label: '执行图', to: '/category/execution-graph' }],
    originals: [{ label: 'FlashInfer 官方博客', url: 'https://flashinfer.ai/' }],
  },
  hardware: {
    title: '区分峰值规格与可复现性能',
    points: ["系统范围：单卡、整机与多节点。","复现条件：精度、软件版本、功耗与拓扑。","资源约束：算力、带宽、容量与通信。"],
    links: [{ label: '并行策略', to: '/category/parallel-strategy' }, { label: 'KV Transfer 与 PD 分离', to: '/category/kv-transfer' }],
  },
  models: {
    title: '把模型公告拆成架构变化',
    points: ["模型身份：检查点、配置、权重与许可。","架构组成：总参数、激活参数与持久状态。","评测条件：推理预算、提示模板与上下文。"],
    links: [{ label: '交互结构实验室', to: '/models' }, { label: '模型缓存对比', to: '/models/compare' }, { label: '架构基础课', to: '/category/model-architecture' }],
  },
  training: {
    title: '同时核对收益、精度与适用范围',
    points: ["优化对象：权重、激活、优化器与 KV。","质量证据：校准 / 训练数据、评测集与精度损失。","执行收益：压缩率、内核支持与端到端性能。"],
    links: [{ label: 'LoRA 与参数高效微调', to: '/category/lora' }, { label: '并行策略', to: '/category/parallel-strategy' }],
  },
  security: {
    title: '先读威胁范围，再读解决方案',
    points: ["影响范围：权限、版本与部署条件。","事件类型：研究演示、确认漏洞与实际事故。","处置依据：维护者公告、修复版本与缓解措施。"],
    links: [],
  },
}
