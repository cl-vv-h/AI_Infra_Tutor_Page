export const newsTopics = [
  { id: 'inference', label: '推理与服务', keywords: ['inference', 'serving', 'vllm', 'sglang', 'kv cache', 'kv-cache', 'pagedattention', 'speculative decoding', 'prefill', 'decode', 'offloading'] },
  { id: 'kernels', label: '算子与编译', keywords: ['kernel', 'compiler', 'triton', 'cuda', 'torch.compile', 'flashattention', 'flashinfer', 'operator fusion', 'gemm'] },
  { id: 'hardware', label: '芯片与系统', keywords: ['gpu', 'npu', 'accelerator', 'rocm', 'instinct', 'blackwell', 'hbm', 'interconnect', 'distributed', 'semiconductor'] },
  { id: 'models', label: '模型与架构', keywords: ['language model', 'transformer', 'attention', 'mixture of experts', 'moe', 'qwen', 'deepseek', 'llama', 'glm', 'multimodal'] },
  { id: 'training', label: '训练与量化', keywords: ['training', 'fine-tuning', 'finetuning', 'quantization', 'fp8', 'int4', 'lora', 'reinforcement learning', 'distillation'] },
  { id: 'security', label: '安全与可靠性', keywords: ['security', 'vulnerability', 'privacy', 'reliability', 'sandbox', 'incident', 'outage'] },
]

export function topicsForItem(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase()
  return newsTopics.filter((topic) => topic.keywords.some((word) => {
    // Short acronyms should not match inside an unrelated word.
    return word.length <= 4 ? new RegExp(`\\b${word}\\b`, 'i').test(text) : text.includes(word)
  })).map((topic) => topic.id)
}
