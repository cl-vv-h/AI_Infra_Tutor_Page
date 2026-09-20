/** Public HF model-card "Downloads last month" observations, not live analytics.
 * Repository variants are exact: Base is not replaced by Instruct or family totals.
 * No visitor data, accounts or credentials are collected by this site.
 */
export const popularityObservedOn = '2026-09-16'
export const popularityMethodUrl = 'https://huggingface.co/docs/hub/models-download-stats'
export interface ModelPopularity { repo: string; downloads: number }
export const modelPopularity: Readonly<Record<string, ModelPopularity>> = {
  'glm-4-7-flash': { repo: 'zai-org/GLM-4.7-Flash', downloads: 1857890 },
  'deepseek-v3': { repo: 'deepseek-ai/DeepSeek-V3-Base', downloads: 2168 },
  'llama-3-1-8b': { repo: 'meta-llama/Llama-3.1-8B', downloads: 507214 },
  'qwen3-8b': { repo: 'Qwen/Qwen3-8B', downloads: 12892330 },
  'qwen3-30b-a3b': { repo: 'Qwen/Qwen3-30B-A3B', downloads: 1859732 },
  'qwen3-5-9b': { repo: 'Qwen/Qwen3.5-9B', downloads: 9468124 },
  'qwen3-5-35b-a3b': { repo: 'Qwen/Qwen3.5-35B-A3B', downloads: 2045514 },
  'mistral-7b-v0-1': { repo: 'mistralai/Mistral-7B-v0.1', downloads: 359752 },
  'mixtral-8x7b-v0-1': { repo: 'mistralai/Mixtral-8x7B-v0.1', downloads: 82131 },
  'gemma-2-9b': { repo: 'google/gemma-2-9b', downloads: 61769 },
  'phi-3-5-mini-instruct': { repo: 'microsoft/Phi-3.5-mini-instruct', downloads: 360734 },
  'olmo-2-1124-7b': { repo: 'allenai/OLMo-2-1124-7B', downloads: 83474 },
  'starcoder2-3b': { repo: 'bigcode/starcoder2-3b', downloads: 85659 },
  'pythia-1-4b': { repo: 'EleutherAI/pythia-1.4b', downloads: 98398 },
  'glm-5-2': { repo: 'zai-org/GLM-5.2', downloads: 982017 },
  'deepseek-v4-flash': { repo: 'deepseek-ai/DeepSeek-V4-Flash', downloads: 1729322 },
  'glm-5-3-flash': { repo: 'zai-org/GLM-5.3-Flash', downloads: 1992040 },
  'kimi-k3': { repo: 'moonshotai/Kimi-K3', downloads: 2223723 },
  'deepseek-v4-1-flash': { repo: 'deepseek-ai/DeepSeek-V4.1-Flash', downloads: 325712 },
}
