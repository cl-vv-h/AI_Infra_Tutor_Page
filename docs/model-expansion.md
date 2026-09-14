# 模型图解扩展记录

## 2026-09-14：GLM-5.2 与逐步学习导览

GLM-5.2 已接入同一套目录、层级图、模块检索、权重账本、缓存预算反算与模型对比。不是替换旧 GLM 检查点的名称。官方配置：78 层、hidden 6144、64 主 Attention heads、前三层 Dense、256 routed experts / Top-8 与一个 shared expert、1,048,576 上下文。未独立核定激活参数量，不沿用旧版本标称值。

资料：

- [官方配置](https://huggingface.co/zai-org/GLM-5.2/blob/main/config.json)
- [模型卡](https://huggingface.co/zai-org/GLM-5.2)
- [SGLang Tutor 的 GLM-5.2 端到端教程](https://github.com/cl-vv-h/SGLang_Tutor/blob/main/learning/zh/sglang-ascend-npu/source-code-walkthrough/examples/02-glm-5.2-end-to-end.md)
- [Indexer 的 replicated projections](https://github.com/sgl-project/sglang/blob/main/python/sglang/srt/layers/attention/dsa/dsa_indexer.py)

图中区别 DSA 的历史 token Top-2048 与 MoE 的专家 Top-8。缓存计入每层 512 latent、64 RoPE 和 128 Index K，按 SGLang Ascend 全层 Index K 分配基线估算；各 rank 复制，不除以 TP。B=4、S=4096、两字节时，主 KV 1404 MiB + Index K 312 MiB = 1716 MiB / rank。FP8 是对三类状态统一一字节的逻辑容量假设，并非特定引擎的物理布局承诺。

IndexShare 只共享位置表。配置 `indexer_types` 与教程对应 SGLang 快照的 `index_topk_freq` 偏移不同，不能将一种排布当成所有后端的运行轨迹。因此当前层图显示 DSA 的共同语义，并明确版本差异，不伪造精确 Indexer 跳层动画。不含临时检索矩阵、位置表、分页填充、量化元数据或 NextN 额外状态。

逐步导览使用当前层实际模块定义，支持前后导航、直接选择步骤、先预测再展开讲解。切层、切阶段和修改条件会同步到讲解；模块选择复用分享 URL。导览是阅读顺序，不是执行 DAG；显式标识缓存支路、可选视觉输入、同源并行残差，以及到最终 LM Head 之前尚未展开的层。学习答案不上传，也不自动判分。

验证：

```sh
node --experimental-strip-types --test tests/glm5-model.test.mjs tests/model-learning.test.mjs
npm run test:models
npm run test:models:render
npm run check
npm run build
```

## 其余请求模型：已核对配置，尚未实现

以下是后续实现约束，不是已完成图解列表。禁止用旧模型的算式替换它们。

| 精确检查点 | 配置中必须单独处理的结构 |
| --- | --- |
| [GLM-5.3-Flash](https://huggingface.co/zai-org/GLM-5.3-Flash/blob/main/config.json) | 45 文本层，34 KDA + 11 DSA；4 路 mHC；视觉输入；DSA 无 RoPE 的主 MLA 与压缩 Index K |
| [Kimi-K3](https://huggingface.co/moonshotai/Kimi-K3/blob/main/config.json) | 93 文本层，KDA + MLA；配置层列表从 1 开始；Attention Residual、latent MoE 与视觉输入 |
| [DeepSeek-V4-Flash](https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash/blob/main/config.json) | 43 target 层，mHC；128 滑窗与不同压缩率；hash-routed 前三层也是 MoE，不是 Dense；配置压缩列表另含辅助层 |
| [DeepSeek-V4.1-Flash](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/config.json) | 40 层因果 Encoder–Decoder；跨层 KV 来源与 Index 来源不同；Engram、视觉与 DSpark 需要独立支路；不能套 Decoder-only 全层独立 KV |

后续每个模型都须核对实现中的字段消费者，再补数据流、张量、缓存与相应测试；不能仅根据 model card 或 config 数字宣称完整支持。
