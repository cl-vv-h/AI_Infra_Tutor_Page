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

## 2026-09-14：DeepSeek-V4-Flash 与压缩状态实验

接入原始 `deepseek-ai/DeepSeek-V4-Flash`，不是 `-0731`、Vision-Exp 或 V4.1。43 个 target 层：0–1 为纯 SWA；2、4…42 为 21 层 CSA；3、5…41 为 20 层 HCA。所有层都是 MoE，其中前三层按 token-id 查表选择专家，其余按分数选择。配置最后一个压缩率属于 MTP，未计入主干。参数量采用模型卡的 284B / 13B 标称口径，不把托管平台统计量当作同一统计范围。

新增 mHC 通路：每个 Attention / MoE 子层前由 Pre 将 `[N,4,4096]` 合并为单路；子层后由 Post 将结果分发并与保留的四路残差混合。图中单独标记旁路携带的 residual、post 和 Hres，未使用普通残差加法连线。Embedding 初始化四路；最终 mHC Head 合并后才进入 Norm 与词表投影。

压缩缓存实验分别显示近期窗口、已保存压缩位置、当前 Decode 读取上限。CSA 每 4 token 形成一条记录，Top-512 只限制读取；HCA 每 128 token 形成一条记录，读取全部压缩历史。计算用 `floor(S/r)`，短块保留在增量状态中，容量在完成压缩块时阶梯式增长；预算反算寻找阶梯最右边界。

计量基线明确区分：

- 权重采用 SGLang 的 EP=1、专家中间维 TP 分片；Indexer 投影、sink、mHC 等复制。官方最小实现的 Indexer heads 与完整专家分配方式不同，不能把两种并行布局混称为同一个引擎。
- KV 计算占用的逻辑记录，而不是最大上下文预分配。一个 512 维向量同时用作 K/V，不乘二；四路 mHC 也不乘四。主 KV 与 Index K 采用用户选择的统一一/两字节容量假设，不是混合量化的物理存储格式。
- 压缩增量状态采用官方最小实现的完整 FP32 `kv_state` / `score_state` 窗口；C4 每份 `[B,8,2D]`，C128 每份 `[B,128,D]`。C4 主与索引各一个 compressor，HCA 仅主 compressor。生产引擎的 online/ring 实现可不同。
- B=1、S=4096、两字节时：窗口 5,636,096 B + 压缩主 KV 22,675,456 B + Index K 5,505,024 B + FP32 增量状态 12,206,080 B = **46,022,656 B / rank**。此预算下最长 S 为 4099，S=4100 才产生下一条 C4 记录。
- 冻结 INT32 `tid2eid` 表每个 hash 层 3,102,720 B，不混入浮点统一位宽账本或 KV 预算。MTP、量化 scale、RoPE 表、临时 logits、分页和图捕获开销均未纳入，不承诺整卡部署容量。

资料：[官方配置](https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash/blob/main/config.json)、[官方模型卡](https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash)、[官方最小实现](https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash/blob/main/inference/model.py)、[SGLang 模型](https://github.com/sgl-project/sglang/blob/main/python/sglang/srt/models/deepseek_v4.py)、[SGLang compressor](https://github.com/sgl-project/sglang/blob/main/python/sglang/srt/layers/attention/dsv4/compressor.py)、[SGLang Indexer](https://github.com/sgl-project/sglang/blob/main/python/sglang/srt/layers/attention/dsv4/indexer.py)。核对日期 2026-09-14；部署复现需另行固定引擎与 checkpoint revision。

`tests/deepseek-v4-model.test.mjs` 校验层型、mHC 边界、复制/分片权重、压缩块边界、状态精度和链接恢复；通用渲染测试另校验三个注意力变体的实际节点序列、旁路、读取数量、预算及对比。以上测试不等于 GPU 推理。

另提供可选真实浏览器回归 `npm run test:models:browser`：先运行生产构建和 `npm run preview -- --host 127.0.0.1 --port 4175 --strictPort`，使用已安装的 Playwright 与浏览器。`MODEL_QA_PLAYWRIGHT` 可指定外部 Playwright 模块位置，`MODEL_QA_CHANNEL=chrome` 可选择已安装的 Chrome；`MODEL_QA_BASE` 可覆盖预览地址。截图仅在设置 `MODEL_QA_SCREENSHOTS` 为仓库外现有目录时保存，不提交个人路径或浏览器用户资料。

本批已在 Chrome 152 的 360、390、768、1440px 视口测试导览答案切换、窄屏详情弹窗与焦点归还、键盘工作区导航、511→512 压缩记录边界、阶段与层切换，并人工查看 mHC / 缓存面板截图；这不等于 Safari、所有设备或 GPU 推理验收。

## 其余请求模型：已核对配置，尚未实现

以下是后续实现约束，不是已完成图解列表。禁止用旧模型的算式替换它们。

| 精确检查点 | 配置中必须单独处理的结构 |
| --- | --- |
| [GLM-5.3-Flash](https://huggingface.co/zai-org/GLM-5.3-Flash/blob/main/config.json) | 45 文本层，34 KDA + 11 DSA；4 路 mHC；视觉输入；DSA 无 RoPE 的主 MLA 与压缩 Index K |
| [Kimi-K3](https://huggingface.co/moonshotai/Kimi-K3/blob/main/config.json) | 93 文本层，KDA + MLA；配置层列表从 1 开始；Attention Residual、latent MoE 与视觉输入 |
| [DeepSeek-V4.1-Flash](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/config.json) | 40 层因果 Encoder–Decoder；跨层 KV 来源与 Index 来源不同；Engram、视觉与 DSpark 需要独立支路；不能套 Decoder-only 全层独立 KV |

后续每个模型都须核对实现中的字段消费者，再补数据流、张量、缓存与相应测试；不能仅根据 model card 或 config 数字宣称完整支持。
