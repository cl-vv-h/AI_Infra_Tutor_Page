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

## 2026-09-14：GLM-5.3-Flash、KDA 与池化索引

接入独立的 `zai-org/GLM-5.3-Flash`：45 个文本层，34 KDA / 11 NoPE DSA，前三层 Dense / 后 42 层 MoE，288 routed experts / Top-8 + 1 shared。模型卡标称 320B 总参数 / 18B 激活；不根据图示权重账本反推完整参数量。一个 NextN 辅助层未计入 45 层主干。

端到端入口先将视觉特征替换文本中的占位 embedding，再展开四路 mHC。新增独立、可分享的 `hc-expand` 模块，避免在单路视觉输出与四路文本主干之间错误连接。24 层视觉塔以 2×14×14 patch 输入，2×2 下采样至 4096 维，再经 Merger 汇入文本；视觉节点列出主要未分片权重，不宣称完整视觉参数盘点。图示 448×448 的 1024→256 token 仅为一个 temporal patch 的例子，实际输入遵循 grid_thw。

mHC 的子层 Pre / Post 保留四路旁路，但最终 HC Head 是**无参数四路均值**，不是 DeepSeek V4 的可学习动态 Head。Dense 层在图中明确标记 Dense FFN，不冒充 MoE。

KDA 的遗忘门沿 key 通道变化，beta 沿 head 变化，不套用 Gated DeltaNet 的标量遗忘门。图解拆明 QKV 及卷积、低秩 forget/output gate、FP32 矩阵与输出 gated RMSNorm。DSA 则压缩 Index K：每四个 token 一个索引池，最多选 512 池并展开为 2048 个原始 token，再加 0–3 个未满尾部；主 MLA 历史仍保存全部 S 条 512 维 latent，不被池化或 Top-k 截断。新的实验面板展示不同 query 的因果可见池数和展开数量，不捏造 learned 排名。

缓存选择 SGLang 无推测解码、EP=1、Attention TP=TP 的**逻辑占用基线**：

- 每个 DSA 层：`S×512×bytes` 主 latent、`floor(S/4)×128×bytes` Index K；key / score 各四槽 BF16 尾部，按 rank 复制。
- 每个 KDA 层：`(64/TP)×128²×4` 字节矩阵；`(3×8192/TP)×3×2` 字节历史卷积窗口，采用 K−1 槽布局。
- B=1 / S=4096 / TP=4 / 两字节时：主 latent 46,137,344 B + Index K 2,883,584 B + 尾部 22,528 B + KDA 矩阵 35,651,584 B + 卷积 1,253,376 B = **85,948,416 B / rank**（81.97 MiB）。四路 mHC 不乘四；只有 KDA 部分随 TP 均分。
- 精度选项仅作用于主 latent 和 Index K，其余状态精度固定。未计 FP8 scale、页尾空位、哨兵请求、最大请求数预分配、视觉临时激活、MTP / ReplaySSM、前缀快照或图捕获。不是整卡部署预算。
- Transformers 参考路径保存展开的 K/V 和 full-history packed indexer 状态，与此 SGLang latent/pool 路径不同；不得将本估算套在该 eager 缓存实现上。

证据：[官方配置](https://huggingface.co/zai-org/GLM-5.3-Flash/blob/main/config.json)、[模型卡](https://huggingface.co/zai-org/GLM-5.3-Flash)、[SGLang 模型（固定 revision）](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/models/glm5_next.py)、[IndexerKPool](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/attention/dsa/dsa_indexer_kpool.py)、[状态布局](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/configs/mamba_utils.py)、[DSA 尾部缓冲](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/mem_cache/memory_pool.py)、[Transformers 语义参考（固定 revision）](https://github.com/huggingface/transformers/blob/93ebf6b11127967f2725cf4d012aae55c3654f5a/src/transformers/models/glm5_next/modeling_glm5_next.py)。核对日期 2026-09-14。

独立测试 `tests/glm53-model.test.mjs` 覆盖层分布、视觉汇合、均值 Head、索引尾部、TP/精度算术、预算边界及权重账本。105 项模型测试、51 个工作区路由、136 组模型对比及 181 个模块链接通过。Chrome 152 在 360、390、768、1440px 通过池边界交互、视觉模块弹窗与 KDA / Dense 切换，并检查缓存和 mHC 截图。关闭详情时仅补救失落的焦点，不用延迟 close 事件覆盖用户已经移往滑块的焦点；浏览器回归显式模拟了这个事件顺序。以上不等于 Safari、所有设备或 GPU 执行验证。

## 2026-09-14：Kimi-K3、Attention Residual 与 LatentMoE

接入独立的 `moonshotai/Kimi-K3`：93 层，69 KDA / 24 Gated MLA；配置使用从 1 开始的层号，网站统一转换为从 0 开始。最后两层 91、92 都是 MLA，不能仅按每四层一次推导。模型卡标称 2.8T / 104B 激活；不把图示 Decoder 权重账本当作完整检查点参数量。第一层 Dense SiTU-GLU，后 92 层 LatentMoE；配置没有 NextN 辅助层。

新增跨层深度实验和独立 AttnRes 图形路径。每 12 层先聚合、再写入原始 prefix 快照并重置块内累计；普通层只累计子层输出。Layer 0 保存输入 embedding，Layer 12 保存 Layers 0–11 的子层输出和；最后从 8 个快照和最后块 prefix 共 9 个候选聚合。打分 Norm、打分投影、输入 Norm 是独立权重，不套 mHC、均值 Head 或普通层输入残差。实验可跳转 0、11、12、13、84、92，显示候选数、快照来源和 bank 生命周期，不伪造 learned 分数。

可展开 LatentMoE 支路图将 routed 与 shared 明确分开：Router 读取 7168 维主干，896 routed experts 选 16 个；routed 支路 7168→3584→专家→加权合并及必要归约→RMSNorm→7168；shared 支路仍读取 7168 维，两个 shared experts 合并为 intermediate=6144。SiTU-GLU 是平滑 tanh 饱和（gate beta=4、up beta=25），不是硬截断。EP=1 普通 TP 下，latent 降/升维投影和路由器复制，专家中间维分片。

KDA 使用完整输出门投影 7168→12288，而 forget gate 仍为 128 维低秩。运行时 `A_log` 按 96 heads 分片；SGLang loader 兼容 128 元素检查点布局并取前 96 个，账本计算运行时张量。MLA 的 NoPE 只跳过旋转：Q/K 仍为 128+64=192 维，V 为 128 维；缓存为 512 latent + 64 未旋转共享 K。没有 DSA Index K 或 Top-k 截断。

缓存基线为固定版本 SGLang、EP=1、Attention TP=TP、无推测解码：

- 24 层 MLA 各 rank 复制 `B×S×576×bytes`。
- 69 层 KDA 保留 `B×(96/TP)×128²×4` 字节矩阵及 `B×(3×12288/TP)×3×2` 字节卷积历史。精度选项不改变这两项。
- B=1 / S=4096 / TP=4 / 两字节：MLA 113,246,208 B + KDA 矩阵 108,527,616 B + 卷积 3,815,424 B = **225,589,248 B / rank**（215.14 MiB）。每请求下一 token 增长 27 KiB / rank。
- AttnRes bank 是每次 forward 重建的临时深度状态，不并入持久缓存容量反算。普通 TP、BF16、未分块 Prefill 下最多 `[B×S,8,7168]`，B=1 / S=4096 为 448 MiB；Decode `[B,8,7168]` 为 112 KiB。这是 bank 张量自身，不含其他临时激活；实际 chunked prefill 以当前块的 token 数为准。
- 不计量化 scale、页尾/allocator、前缀快照、视觉/打分工作区、通信或图捕获。Transformers 参考代码保存展开 K/V，不能直接使用这里的 absorbed-MLA 容量。

视觉塔为 27 层、hidden=1024、QKV width=1536、12 heads；2D RoPE 与双向视觉注意力不因文本 NoPE 而取消。逐帧 14×14 Conv2d patch 后，按 grid item 做时间均值与空间 2×2 拼接，PatchMerger V2 用 4096→4096→7168 GELU 和输出 RMSNorm。视觉输出数量 `Σ(h×w/4)` 不等于视频全部 patch 数除四；主要视觉权重另列，不混入 Decoder 账本。

证据：[官方配置](https://huggingface.co/moonshotai/Kimi-K3/blob/main/config.json)、[模型卡](https://huggingface.co/moonshotai/Kimi-K3)、[官方文本参考实现](https://huggingface.co/moonshotai/Kimi-K3/blob/main/modeling_kimi_linear.py)、[官方视觉参考实现](https://huggingface.co/moonshotai/Kimi-K3/blob/main/modeling_kimi_k3.py)（两个参考文件页面显示初始提交 `c5d1dd4c428bd1ce8b88c5044f3b6ccde9e3b721`）；[SGLang K3 实现](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/models/kimi_k3.py)、[AttnRes](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/attn_residual.py)、[缓存配置](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/configs/kimi_linear.py)。核对日期 2026-09-14。

`tests/kimi-k3-model.test.mjs` 独立检查层分布、块边界、候选数、运行时权重算术、NoPE 共享 K、缓存精度及预算边界；通用模块链接验收按目标层解析动态 Shape，不拿 Layer 0 的快照数量套所有层。真实浏览器回归覆盖深度实验、LatentMoE 双支路、最后 MLA、精度/TP 切换和 URL 条件保留。这些是图解与算式验证，不是 GPU/NPU 推理验收。

## 其余请求模型：已核对配置，尚未实现

以下是后续实现约束，不是已完成图解列表。禁止用旧模型的算式替换它们。

| 精确检查点 | 配置中必须单独处理的结构 |
| --- | --- |
| [DeepSeek-V4.1-Flash](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/config.json) | 40 层因果 Encoder–Decoder；跨层 KV 来源与 Index 来源不同；Engram、视觉与 DSpark 需要独立支路；不能套 Decoder-only 全层独立 KV |

后续每个模型都须核对实现中的字段消费者，再补数据流、张量、缓存与相应测试；不能仅根据 model card 或 config 数字宣称完整支持。
