/** Editorial reading questions, not generated conclusions about any article. */
export const newsStudyGuides: Record<string, { title: string; questions: string[]; links: Array<{ label: string; to: string }>; originals?: Array<{ label: string; url: string }> }> = {
  inference: {
    title: '把吞吐数字放回真实请求中',
    questions: ['比较的是 TTFT、逐 token 延迟，还是吞吐？是否给出了延迟约束？', '输入 / 输出长度、并发量和缓存命中率是否一致？', '优化作用于调度、KV 管理，还是单次模型执行？'],
    links: [{ label: '推理指标与阶段', to: '/category/inference-basics' }, { label: 'KV Cache 与显存', to: '/category/kv-cache-memory' }, { label: 'SGLang 源码路线', to: '/category/sglang' }],
    originals: [{ label: 'SGLang 官方技术博客', url: 'https://www.sglang.io/blog' }],
  },
  kernels: {
    title: '从单算子收益追到整网收益',
    questions: ['测试覆盖哪些 Shape、数据类型和硬件？', '计时是否包含编译、预热、同步及数据搬运？', '结果来自单算子微基准，还是端到端服务？'],
    links: [{ label: 'Decode 算法', to: '/category/decode' }, { label: '执行图', to: '/category/execution-graph' }],
    originals: [{ label: 'FlashInfer 官方博客', url: 'https://flashinfer.ai/' }],
  },
  hardware: {
    title: '区分峰值规格与可复现性能',
    questions: ['对比的是单卡、整机，还是多节点系统？', '精度、软件版本、功耗与通信拓扑是否披露？', '实际瓶颈在算力、显存带宽、容量，还是跨卡通信？'],
    links: [{ label: '并行策略', to: '/category/parallel-strategy' }, { label: 'KV Transfer 与 PD 分离', to: '/category/kv-transfer' }],
  },
  models: {
    title: '把模型公告拆成架构变化',
    questions: ['具体是哪个检查点？是否开放配置、权重及许可？', '总参数、激活参数和持久状态分别如何变化？', '基准是否对齐推理预算、提示模板和上下文条件？'],
    links: [{ label: '交互结构实验室', to: '/models' }, { label: '模型缓存对比', to: '/models/compare' }, { label: '架构基础课', to: '/category/model-architecture' }],
  },
  training: {
    title: '同时核对收益、精度与适用范围',
    questions: ['改动作用于权重、激活、优化器，还是 KV Cache？', '校准 / 训练数据、评测集和质量损失是否说明？', '压缩后的模型是否获得真实的端到端加速？'],
    links: [{ label: 'LoRA 与参数高效微调', to: '/category/lora' }, { label: '并行策略', to: '/category/parallel-strategy' }],
  },
  security: {
    title: '先读威胁范围，再读解决方案',
    questions: ['攻击者需要什么权限？哪些版本、部署条件受影响？', '内容是研究演示、已确认漏洞，还是实际事故？', '是否有维护者公告、修复版本和明确的缓解措施？'],
    links: [],
  },
}
