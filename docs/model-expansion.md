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

## 2026-09-14：逐 rank 实验第一阶段——TP × 独立 DP

权重工作区增加逐 rank 面板：选择本层模块，拖动 TP、独立服务副本数（1/2/4/8）、统一假定位宽（4/8/16/32），点选教学 rank，查看模块边界输入输出、内部张量与逐项权重 Shape。沿用已核对的各模型 TP 图解，不把所有矩阵一律除以 TP。复制的 Norm、Router、MLA 投影与分片的专家/Attention 权重继续采用不同 Shape。

此阶段 DP 是独立完整模型副本，每个副本包含自己的 TP 组；总卡数 `replicas × TP`。B 是**每副本**请求数，所有副本等长且同一阶段的示例中共有 `replicas × B` 个不同请求。TP 组内协作处理同一批，独立副本处理不同请求，DP 不降低单卡权重。同一 Shape 不代表不同 TP 分片具有相同数值。图中 rank 编号只是教学坐标，不宣称实际 launcher 的进程编号。

参考：[SGLang DP / DPA 区别（固定 revision）](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/docs/docs/advanced_features/dp_dpa_smg_guide.mdx)。本阶段没有启用 `--enable-dp-attention`，不把独立 DP 的卡数公式套到 DPA；没有改变其他工作区的每副本缓存口径。

当前模块的每卡载荷按 `Σ(各权重本地元素数 × multiplicity × bits / 8)`；TP 组载荷乘 TP，所有独立副本再乘 replicas。未知 Shape 使全部合计停算，不静默漏项。权重位宽改变 bytes 而不改变逻辑 Shape，与 KV 精度独立。输入输出沿用逻辑模块边界，可能已包含 TP 输出归约；不是 GEMM 临时 partial output 或通信 trace。

`replicas` / `rank` 进入分享 URL 白名单；畸形链接提示并回退；交互缩小拓扑时将选中 rank 夹到最后一张有效卡。未附带任何个人信息、启动凭据或远程推理调用。

待续：SGLang DPA 分组、EP 的专家归属与实际 token dispatch、混合精度及量化 scale/packing。当前明确限定 EP=1、PP=1，统一位宽不代表 AWQ/GPTQ/FP8 的物理存储或模型支持清单。测试验证公式和网页，不是 GPU/NPU 部署验证。

本阶段通过 115 项模型测试、54 个工作区路由、153 组对比、197 个模块链接、18 个目录条目的渲染检查，以及 TypeScript、生产构建与改动文件 ESLint。Chrome 152 在 360/390/768/1440px 验证 TP/副本/位宽键盘滑块、选中 rank、缩小拓扑和刷新 URL，共 47 次页面宽度检查；人工查看窄屏与桌面面板截图。截图中的固定导航遮挡属于长元素截图的视口叠层，未据此宣称所有设备视觉验收。

## 2026-09-14：EP 专家归属与 MoE-TP 分片

逐 rank 面板接入 GLM-5.2、GLM-5.3-Flash、Kimi-K3、DeepSeek-V4-Flash 的 EP=1/2/4/8（须整除当前 TP）。每个 routed 权重显式标记专家轴，未按权重名称推断；Router、shared、latent 升/降维、Attention 和 Dense 分支不跟随 routed EP 改动。未经核对的其他模型仍限制 EP=1，不能据此宣称没有 EP 能力。

本阶段固定 SGLang revision `96d91ef9266d2bebd8e8c09ef1f28b2d521631ff` 的 **A2A backend=none、MoE DP=1、PP=1、独立服务副本、无 DPA** 基线；关闭 shared expert fusion、强制 shared TP1、EPLB、冗余专家及弹性布局。它不等于 DeepEP/All-to-All 方案，也不是任意硬件/量化配置的启动保证。

读取实现后采用：

- `MoE-TP = TP / EP`，routed 本地专家数 `E / EP`，专家本地中间维 `I / MoE-TP`。因此固定总 TP 时，routed 每卡元素数 `3×E×H_expert×I/TP` 不随 EP 变化，不能在原 TP 分片后再次除 EP。
- rank 的 EP 坐标是 `floor(tp_rank / MoE-TP)`，MoE-TP 坐标为余数。同一专家的 MoE-TP ranks 连续，EP peers 按 MoE-TP 步长跨组。独立副本的教学 rank 编号在各组外增加偏移，不冒充 launcher 实际编号。
- 无 EPLB/冗余时，第 e 个 EP 组持有 `[e×E/EP, (e+1)×E/EP−1]` 连续专家。全卡数仍为 `replicas×TP`，EP 不再乘卡数。
- Kimi-K3 的 routed H=3584，shared H=7168；其 latent 前后投影和 Norm 复制，不按专家数分片。`none` 后端、shared 未融合的本基线中，shared 中间维仍按完整 TP 分片，不能套到 shared TP1 的 A2A 路径。
- 激活继续拆至单个本地专家：`[T_e,H_expert] → [T_e,2I_local] → [T_e,I_local] → [T_e,H_expert]`。MoE-TP>1 的 down 输出是部分和，不能直接冒充模块最终输出。T_e 由真实 Router/hash 结果决定；没有执行推理时不宣称精确本地 token 数。标准不同专家 Top-k 下，T_e∈[0,N]，本地 assignment 总数的上下界由专家集合大小推导，所有 EP 组合计 N×k，不能重复乘 MoE-TP。

EP 状态通过 `ep` 分享参数保留；非法或未核对组合回退并提示，交互缩小 TP 时同步缩小 EP。其他工作区仍显示 EP=1 基线，面板明确标出作用域，避免把 EP 结果与旧账本混为同一配置。

证据：[并行宽度推导](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/runtime_context.py)、[进程组构建](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/distributed/parallel_state.py)、[FusedMoE 专家加载及中间维分片](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/moe/fused_moe_triton/layer.py)、[DeepSeek/GLM 共享专家](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/models/deepseek_v2.py)、[Kimi-K3 LatentMoE 与共享专家](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/models/kimi_k3.py)。GLM-5.3 与 V4 对 MoE 的委派也按同 revision 的 `glm5_next.py` / `deepseek_v4.py` 核对。

待完成仍包括 DeepSeek-V4.1、DPA 与 All-to-All 路由、真实混合量化布局，以及将验证后的并行配置贯通其他工作区。本阶段不是整体目标完成。

本阶段验收：119 项模型测试、54 个工作区路由、153 组对比、197 个模块链接及 18 个目录条目渲染检查通过；TypeScript、生产构建及修改文件 ESLint 通过。Chrome 152 在 360/390/768/1440px 验证 EP 滑块、专家 ID、通信组、权重/latent 激活 Shape、刷新恢复与 TP 缩小时的 EP 约束，合计 55 次页面宽度检查通过；人工查看窄屏和桌面的 EP 分组截图。未执行 GPU/NPU 推理。

## 2026-09-15：DeepSeek-V4.1-Flash 参考实验与逐 rank 张量流

新增独立路由 `#/models/deepseek-v4-1-flash`，从模型目录的参考实验入口进入。采用官方最小实现 revision `517ef625df97ec57aadc91b67506a57c20fdc5bb`，不是将 V4 改名。当前不进入通用目录筛选/模型对比，也不声称已核对 SGLang V4.1 后端；通用注册与更多分支交互仍待完成。

40 层分为 Encoder 0–19 / Decoder 20–39。前两层仅 SWA；全局主 KV 与 Index K 只有 Layer 2/8/14/20 四个 owner。24/28/32/36 重新计算 query 排序，复用 Layer 20 的 KV 和 Index K；其余层连 Top-k 位置表也复用。40 个层按钮和四类来源跳转把缓存所有者与读取者分开。Layer 20 候选池按 8-position 块筛选，最多 2048 块且保留最新块，再取 Top-512；只展示因果数量与上限，不编造 learned 排名。

Single-Pass mHC 展示系数的跨子层依赖：Attention 使用上一层 FFN 的 pre，FFN 使用本层 Attention 的 pre；首层初始化 one-hot，末层以最后 FFN pre 合并。保留四路残差及当前子层 post/comb，不能套 V4 的独立动态 Head。

逐 rank 控制同时驱动层图、张量快照、权重布局和缓存口径。官方参考布局为 Attention heads / output groups 按 world 分片，完整 routed 专家按 world 分配；shared 专家每卡复制，没有专家内部 TP。独立 DP 副本是外层复制，归约只在同一副本内发生。逐 rank 显示 Q head 区间、专家 ID 区间、归约组、Prefill B×S / Decode B 的输入输出 Shape，以及对应矩阵与全体本地专家的权重载荷。

Attention 张量快照区别完整 head 输出与 wo_b 部分和，列出分组 wo_a 的 `[N,8/world,4096] → [N,8/world,1024]`，以及同 Shape 的归约前后不同语义。MoE 明确单专家 T_e 未知，整专家 down 输出不是 MoE-TP 部分和；scatter-add 后跨 rank 求和，之后才加 shared，不能把 shared 一起重复归约。此路径是输出 AllReduce，不冒充 token All-to-All。支路快照并列展示，不宣称真实 kernel 时间线。

Engram 层为 1 / 14。行表按 `ceil(rows/world)` 分片，界面区别合法全局 ID 与补齐行；Layer 14/world=8 最后一卡有 6 行 padding，仍计入存储。查表输出 `[N,24,256]` 在本地屏蔽非本卡行，再做归约、拼接及复制的 6144→25600 投影。每路门控写回四路主干；图像位置屏蔽注入。实际命中稀疏不代表只保存命中的权重。

两种缓存口径不混算：

- 紧凑格式设计：主 KV 每记录 256 B FP4 + 32 B E4M3 scale，Index K 64 B FP4 + 4 B E8M0 scale；SWA 512 B FP8 + 16 B scale。偶数 S 的全局缓存为 `890×B×S` 字节，奇数按 floor(S/2) 计算。
- 参考实现：量化 kernel 的 `inplace=True` 将反量化结果写回 BF16，主 KV / Index K / 窗口实际仍用两字节 buffer，不能因函数名包含 FP4 就算半字节。
- B=1/S=4096 时，紧凑格式的有效记录 + 三个 C2 FP32 增量状态为 **6,373,376 B**，参考 BF16 口径为 **18,374,656 B**，都按 rank 复制而非除 world。最大上下文预分配单列，不混同已占用记录。
- 本层权重区分 FP4 输入轴打包、FP8 32×32 scale、Engram 行内 scale、BF16 wo_a 和 FP32 mHC。统一 4/8/16/32-bit 只用于理论对照，不冒充受支持的实际量化方案。未计 kernel repacking、分配器、全模型权重、视觉、DSpark 或临时工作区。

实验链接白名单保存 layer、B、S、world、replicas、rank、阶段、缓存口径、权重格式和观察支路；拓扑收缩时夹紧 rank。没有远程推理调用、用户数据上传或凭据。

证据：[官方配置](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/517ef625df97ec57aadc91b67506a57c20fdc5bb/config.json)、[发布参数](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/517ef625df97ec57aadc91b67506a57c20fdc5bb/inference/config.json)、[主干与并行布局](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/517ef625df97ec57aadc91b67506a57c20fdc5bb/inference/model.py)、[量化 kernel](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/517ef625df97ec57aadc91b67506a57c20fdc5bb/inference/kernel.py)、[视觉](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/517ef625df97ec57aadc91b67506a57c20fdc5bb/inference/vision.py)、[模型卡](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash)。主干源码页核对到同一 initial revision；不把平台自动生成的 SGLang 启动片段当作实现证据。

未完成：V4.1 的通用目录/对比/学习工作区集成，视觉分辨率与 DSpark 验证循环交互，CED 优化 Prefill 与 SWA Bounded Replay，SGLang DPA/All-to-All，以及其他模型的真实混合量化布局。当前参考 forward 运行全部 40 层，不能将模型卡的优化 Prefill 标称当作已实现路径。整体目标仍未完成。

本批验收：128 项模型单元测试、54 个通用工作区路由、153 组模型对比、197 个模块链接、18 个通用目录条目与 80 个 V4.1 layer/world 静态路由通过；TypeScript、生产构建、改动代码 ESLint 与课程分包检查通过。Chrome 152 在 360/390/768/1440px 验证来源跳转、候选边界、缓存/权重格式、Engram 尾卡 padding、64-rank 拓扑的副本内归约组、Prefill Shape、拓扑缩小与 URL 恢复，71 次宽度检查通过；人工查看移动和桌面来源面板与张量流截图。模型本身未做 GPU/NPU 执行验证。

## 2026-09-15：EP 配置贯通结构图、rank 面板与权重账本

将 EP 权重格式化提取为单一函数 `formatWeight`，结构图的桌面/弹窗 Inspector、逐 rank 面板与全部 Decoder 账本共同使用。不再出现 rank 面板为 EP=4、详情仍显示 EP=1 的两套专家 Shape。仅显式标注 routedExpert 的权重采用专家轴 E/EP 与中间维 I/(TP/EP)；shared、Router、Norm、Attention 和 latent 投影保持原有 TP/复制规则。未核对 EP 的其他模型继续限制为 1。

全工作区配置条显示 TP、EP、MoE-TP、独立副本、rank 与位宽，支持跳转修改。模块定位、导览与工作区切换保留已有 URL 条件；TP 缩小时 EP/rank 继续遵循原有夹紧规则。结构图的模块输入输出仍为归约后的逻辑边界，不假装是局部 GEMM 的部分和。

桌面固定 Inspector 增加视口高度限制、独立纵向滚动和键盘焦点入口，避免长详情中的专家权重一直位于屏幕之外。浏览器测试不仅检查 Shape 文本存在，还将目标权重滚入视口并断言完整可见；已人工查看窄屏弹窗与桌面修正后的截图。

账本逐项显示当前 EP Shape，新增全部图示 Decoder 权重在独立副本下的总载荷。固定总 TP 时，routed 权重改变轴形状但每卡总元素数不变；全局唯一参数量、每卡值与 TP×副本总存储分别标明。缓存页明确当前 EP 只改变 routed 权重，Attention TP 与每副本 B 不变，因此不额外除 EP 或 DP。

Kimi LatentMoE 支路图增加本地专家激活 `[T_e,3072/(TP/EP)]` 与 shared 激活 `[N,6144/TP]`，同时保留完整专家结构作对照。T_e 仍为真实路由决定的未知数；归约后的 latent 才能做非线性 Norm。模型对比台继续使用独立 EP=1 条件，并在工作区配置条明确提示，尚未扩展为 EP 对比。

并行口径仍是前一阶段固定 SGLang revision 的 A2A=none、MoE DP=1、无 DPA/共享融合/EPLB/冗余专家；本次集中统一已核对的算式，不新增未经验证的后端布局。V4.1 仍采用其独立官方参考实验。整体目标未完成，DPA/All-to-All、通用 V4.1 集成及真实混合量化待继续。

验收：129 项模型测试通过；新增 36 组模型/EP/工作区静态路由，检查桌面详情、弹窗详情、rank 面板及账本具有相同本地专家 Shape，同时验证 Kimi routed/shared 激活尺寸。原有 54 个通用工作区路由、153 组对比、197 个模块链接、18 个目录条目与 V4.1 的 80 组路由继续通过。TypeScript、改动文件 ESLint、生产构建及分包检查通过；Chrome 152 的 360/390/768/1440px 交互回归含跨工作区定位与 EP 保留，75 次宽度检查通过。没有执行 GPU/NPU 推理。

## 2026-09-15：GLM-5.2 DP Attention 与不均匀负载实验

新增独立路由 `#/models/glm-5-2/dpa`，从 GLM-5.2 工作区进入。它与普通 TP/独立副本页面的参数分别保存，避免将 DPA 请求组与完整模型副本混称为一个 DP 滑块。当前仅核对 GLM-5.2 所继承的 DeepseekV2 路径；不宣称所有模型、所有后端已接入 DPA。

固定 SGLang revision `96d91ef9266d2bebd8e8c09ef1f28b2d521631ff`，CP=PP=MoE-DP=1、A2A=none、Dense MLP 使用总 TP，无图捕获、Gatherv、FP8 通信、重叠调度、EPLB、冗余专家、shared 融合或 shared TP1。可调总卡数/TP、Attention DP、EP、层、各组 0–64 个请求、阶段、共同历史 S、统一权重位宽和逻辑缓存精度；rank 按钮显示当前 Attention 与 MoE 分组。

核对并实现：

- `Attention TP = TP / DP`，`MoE-TP = TP / EP`。Attention peers 连续；同一专家的 MoE-TP peers 连续，EP peers 按 MoE-TP 步长分组；DP 与 EP 均不额外乘卡数。EP peers 可跨 Attention DP 边界。
- 每组 B_i 可不同，也可为 0。有效 N_i=Decode B_i / Prefill B_i×S；原始数据归各自 Attention 组。FFN 看到汇合后的全局缓冲，不把它的 N 当作当前组 N_i。Attention 只展示有效数据 Shape，执行缓冲的补齐行另列。
- 先将各 N_i 对齐到 Attention TP，再按 eager 启发式选模式。DP>1 的 Prefill 为 SUM_LEN；Decode 在 `2×SUM >= DP×MAX` 时选 MAX_LEN，否则 SUM_LEN。图捕获或其他后端可覆盖选择，未纳入本实验。
- MAX_LEN 的汇合在 Attention TP>1 时先做组内 ReduceScatter，再做总 TP AllGather；Attention TP=1 时直接 AllGather。SUM_LEN 基线把各组写进全局零缓冲的不同区间，再以 AllReduce 汇合；复制输入只由对应贡献者写入，不能重复求和。返回路径完成 FFN 结果归约、按组区间取回并去掉补齐；可能融合 ReduceScatter / Attention TP AllGather，不将语义步骤当作唯一 kernel 顺序。
- **DP=1 自动关闭 DPA**，不再按 Attention TP 额外补齐或虚构 DPA Gather/Scatter。全组空闲时只显示空数据边界，不声称必须执行 collective；常驻权重仍保留。
- TP8/DP4、Decode B=[3,1,0,2] 时：对齐 [4,2,0,2]，选择 MAX_LEN [4,4,4,4]；6 个有效 token，16 行 FFN buffer，10 行 padding。改成 S=4096 的 Prefill 时 SUM_LEN=24576 行、padding=0。补齐行不是实际请求，不写成历史 KV，也不假设产生合法 expert assignment。
- Attention 权重按 Attention TP 格式化，FFN 按总 TP 与 EP / MoE-TP 格式化，复制张量不切分。增加 DPA 可增大每卡 Attention 权重；固定总 TP 改 EP 不再次减少 routed 字节。前三层按 Dense 而非 MoE 展示。所有数字限定本层图示权重的统一位宽理论载荷，不含真实量化元数据。
- 缓存继续明确 GLM-5.2 Ascend 全层预留 Index K 的逻辑口径：78×704×S×bytes×B_i / rank。公平对照保持同一批请求和相同卡数，普通 TP 总缓存为 `ΣB_i×78×704×S×bytes×TP`，DPA 总缓存最后一个因子改为 Attention TP。缓存不随通信补齐增大。空闲示例不保留历史前缀；不能套用为真实服务器空闲时的驻留显存。

来源：[DP / DPA 概念](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/docs/docs/advanced_features/dp_dpa_smg_guide.mdx)、[宽度推导](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/runtime_context.py)、[进程组](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/distributed/parallel_state.py)、[LayerCommunicator](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/communicator.py)、[DP Gather / Scatter](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/dp_attention.py)、[对齐后再选择模式](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/model_executor/forward_batch_info.py)、[Attention 构造的 attn_tp_size](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/models/deepseek_v2.py)。GLM 继承入口另与本地 SGLang Tutor 的 GLM-5.2 端到端教程核对。

分享 URL 仅保存本实验配置，不包含用户标识、推理地址或密钥；新增加的 DPA 组默认 2 请求，缩小拓扑时截取保留组并夹紧 EP/rank。未调用远程推理或提交任何个人数据。其他模型的 DPA、All-to-All token dispatch、通用 V4.1 集成与混合量化仍待续，整体目标未完成。

增加可交互的 FFN 缓冲区分段图：有效 token、Attention TP 对齐补齐和 MAX_LEN 额外补齐分别使用颜色及纹理，横条按真实行数比例展示。各组卡片列出左闭右开的缓冲区间与有效返回区间；空闲组在 MAX_LEN 中可能只含补齐槽，在 SUM_LEN 中则为空区间。点击或键盘激活组卡会保留组内 Attention TP 坐标、切换当前观察 rank，不改变请求负载。TP8/DP4 的 `[3,1,0,2]` 示例将 10 行 padding 进一步区分为 2 行对齐补齐和 8 行 MAX 额外补齐。图只创建至多每组 3 段，不随百万 token 数生成 DOM。

验收：134 项模型单元测试通过；30 个 DPA TP/DP/layer 静态路由及空闲、不均衡、分段区间边界通过。原有 36 组 EP 共享布局、54 个通用工作区路由、153 组对比、197 个模块链接、18 个目录条目与 V4.1 的 80 组路由继续通过。TypeScript、改动文件 ESLint、生产构建、276 个课程正文独立分包检查通过。Chrome 152 在 360/390/768/1440px 完成负载滑块、MAX/SUM 切换、EP 权重、组卡键盘操作、Prefill、空闲、URL 恢复及拓扑收缩检查，91 次宽度检查通过，无页面运行时错误。人工检查移动与桌面数据流及分段图截图。没有执行 GPU/NPU 推理；上述结果不证明实际部署性能或显存峰值。

## 2026-09-15：V4.1 共享工作区与八步学习导览

V4.1 参考实验接入与其他模型相同的「结构图 / 缓存容量 / 权重清单」三工作区导航；每次仅显示一个 panel，支持方向键、Home/End、ARIA 关联和键盘焦点。结构图区放置端到端边界、CSA2 来源与 mHC 依赖；缓存区保留两种不同存储口径；权重区同时展示逐 rank 输入输出和详细参数表。不把官方参考实现改称为 SGLang 后端。

所有工作区共享原有层、B、S、world、独立 DP、副本内 rank、阶段、缓存格式、权重格式与支路。URL 增加白名单 `view`，旧链接默认结构图；非法值带提示回退。缓存 owner 可跨工作区定位到来源层，结构可直接进入逐 rank 张量视图，权重区可返回当前层残差流。定位等待目标 URL 状态实际提交后再滚动和聚焦，修复路由过渡期间对隐藏 panel 提前聚焦的浏览器问题。

新增 8 步「先预测，再验证」导览：四路输入、KV/Index/Top-k 所有者、Single-Pass mHC、head 分片与部分和、完整专家与 shared、Engram 行分片、缓存口径、常驻权重与量化。步骤只设置教学层、工作区与观察支路，保留所有数值条件。问答从现有参考算式计算，跟随当前 rank、阶段、层与存储格式；用户手动切到其他层时不继续展示预设层的假答案。换步或改参数后答案重新收起，回到旧配置也不会自动揭示；支持直接跳步、退出、定位演示和 URL 恢复，不保存成绩、身份或浏览历史。

此批完成共享工作区与基础学习流程接入；V4.1 尚未进入通用目录筛选和跨模型缓存对比。后续仍需保留它的跨层 owner、参考 BF16 / 紧凑设计与完整专家 EP 区别，不能直接注入旧 V4 的配置对象。其他模型 DPA / All-to-All 与真实混合量化、发布权限问题仍待解决，整体目标未完成。

验收：136 项模型单元测试通过，包含导览条件保留与动态答案的独立数值断言。V4.1 静态路由由 80 扩至 240 个 layer/world/workspace 组合，验证恰好一个可见 panel、ARIA 关联与全部 8 步的定位目标；原有通用模型、EP、对比、目录与 DPA 静态检查继续通过。TypeScript、改动文件 ESLint、生产构建和课程独立分包检查通过。Chrome 152 在 360/390/768/1440px 的回归共 99 次宽度检查通过；实际点击验证跨工作区焦点、owner 跳转、全部导览步骤、改参及回到旧步骤后的答案重置、Engram 尾卡 6 行 padding、键盘切换和重载保留，页面无运行时错误。人工查看移动与桌面导览截图，移动端步骤改为两列以减少滚动。没有执行实机模型推理或性能测试。

## 2026-09-15：V4.1 进入统一目录与跨模型缓存对比

新增 `model-directory` 元数据层，将 V4.1 参考实验与 18 个通用模型一起用于搜索、架构筛选、选择与对比。没有将参考模型伪装为旧 `ModelArchitecture` 定义，也没有让它进入未经核对的通用 Decoder/权重推导。原有 V4.1 独立工作区和参考算式继续作为权威计算路径。

目录现有 19 项。V4.1 可按名称、CSA2、Engram、Reindex、跨层 KV owner 以及真实参考权重名搜索，归入压缩注意力与 MoE 筛选；层占比为 2 SWA-only + 38 SWA/CSA2（包含复用）。参数文案区分 552B 主干与约 196B Engram，8B Prefill / 16B Decode 明确为 CED 优化口径，不表示最小参考 forward 已实现优化。移除原来位于筛选结果外的临时入口。

对比页可以选择 V4.1 与任意现有模型，新增 V4/V4.1 预设。共同条件为 B、S 和单副本卡数；V4.1 的 world 同时决定 Attention TP 与完整专家 EP，其他模型保留原对比 EP=1。V4.1 专用存储选项独立于通用 KV 位宽：参考 BF16 buffer 或紧凑设计（含已核对的 scale）。切换通用 FP8 假设不改变 V4.1 的值；页面明确这些是各自存储格式下的容量对照，不是同精度或性能排行榜。

对比计算直接复用 `v41Cache`：四个 owner 的主 KV、Index K、40 层 SWA 和三个 C2 FP32 增量状态分别列出。B1/S4096 每卡参考值 18,374,656 B，紧凑设计 6,373,376 B；卡数只扩大总存储，不将每卡完整缓存再除 world。单请求边际增长保留 C2 阶梯：紧凑 S4096→4097 增 356 B，4097→4098 增 1,424 B。到最大上下文不外推下一 token。仍不包含候选 mask、Top-k 位置表、最大上下文预分配或整卡开销。

比较链接保存独立的 `v41storage`。从对比进入 V4.1 时将 TP 映射为 world、保留 B/S/存储格式并打开缓存工作区；反向链接按单副本对照 V4，S<1024 时说明对比范围并不自动改写长度。增长图的对数横轴修正为 1K–1M 的十个倍增区间，1M 端点位于绘图区，不再超出坐标范围。

本批完成此前待续的 V4.1 目录/筛选/缓存对比接入。SGLang DPA/All-to-All 的跨模型覆盖、其他模型真实混合量化与上线发布仍待继续；没有改变 Git 凭据、周报模型或新闻工作区。

验收：140 项模型单元测试通过；19 项目录的 27 组注意力/FFN 筛选组合、原有 153 对通用模型，以及新增 144 组 V4.1/其他模型/格式/位宽/容量视图组合通过。检查独立存储字段往返、四个 owner 的精确字节、C2 奇偶阶梯与对比曲线全部落在 1K–1M 横轴内。240 个 V4.1 工作区路由、8 步导览、30 个 DPA 路由和原有 EP/模块链接检查继续通过。TypeScript、ESLint、生产构建及课程分包检查通过。Chrome 152 在 360/390/768/1440px 完成搜索选择、两种缓存格式、通用位宽不改变 V4.1、TP 组总量、重载和双向参数传递，111 次宽度检查通过，无页面运行时错误；人工查看目录和对比的移动/桌面截图。没有进行 GPU/NPU 推理或性能验证。

## 2026-09-15：专家量化加载布局与 TP / EP 联动

逐 rank 权重工作台增加独立的「专家权重加载布局」对照。GLM-5.2、GLM-5.3-Flash、Kimi-K3 和 DeepSeek-V4-Flash 的 routed MoE 模块可以拖动格式滑块或点击格式卡片，比较 BF16 逻辑基线、FP8 block 128×128、MXFP8 1×32；FP4 1×32 加载分支只在 V4 对照中开放。Dense、Attention 和未核对模型不生成虚构的专家张量；V4.1 继续沿用其独立参考格式。

来源固定到 [SGLang Fp8MoEMethod.create_fp8_moe_weight_](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/quantization/fp8.py#L1184)。对照是将分配协议应用到已核对的逻辑 Shape，不是原生量化检查点支持列表、转换器或启动配置。GLM-5.2 的[公开配置](https://huggingface.co/zai-org/GLM-5.2/raw/main/config.json)声明 BF16，没有 quantization_config；页面明确指出这个边界。

无 Aiter、HIP INT4、bias、共享专家融合、EPLB 或冗余专家的 gated 基线：每卡 E_local=E/EP，I_local=I/(TP/EP)，gate/up 逻辑形状为 [E_local,2I_local,H]，down 为 [E_local,H,I_local]。Kimi routed 使用 latent H=3584，不误用主干 H=7168。FP8 不改变 payload Shape；FP4 使用 INT8 容器存两个 FP4，最后一轴减半。gate/up 的 scale 分别分块，校验单独的 I_local 对齐，不用合并后的 2I_local 掩盖非法分片。

FP8 block scales 为 FP32，MXFP8 scales 为 UINT8/E8M0。FP4 对照采用该非 Aiter 方法的默认 FP32 scale，即每 32 个逻辑输入元素另占 4 B，不套用 V4.1 参考实现的 E8M0 1 B。列出各张量的逻辑 Shape、payload Shape/dtype、scale Shape/dtype 与精确字节；总量分每 rank、TP 组和所有独立 DP 副本。格式卡片显示同条件的各协议容量，比例只相对 routed 专家 BF16，不称为整模压缩率。

`packing` 为分享 URL 白名单字段，BF16 默认省略；非法或超出模型核对范围的格式带提示回退。切换格式不改变统一假定位宽、缓存精度、B/S、rank 或 TP/EP，原有 Inspector/Decoder 理论总账仍独立。选择其他层或模块保留格式条件，但非 routed 模块不显示加载面板。

范围限于加载时注册的权重与 scale 张量，不包括 post-load padding/shuffle/requantization、转换峰值、最终 kernel buffer、allocator、通信、激活或 KV。FP8 block / MXFP8 假定序列化量化检查点和 dynamic activation scheme；BF16 是独立无 scale 基线。这些数值不是实际 GPU/NPU 峰值、精度或部署支持证明。

验收：原有 140 项模型单元测试继续通过，新增 4 项测试覆盖独立手算、非法/尾块边界、全部已支持模型每层及 TP/EP/格式组合（超过 7,000 例）、URL 保留和格式白名单；`npm run test:models:packing` 另验证 130 个静态渲染组合及 Dense 排除。原有模型渲染套件继续通过。TypeScript、ESLint、生产构建与 276 份课程正文分包检查通过。Chrome 152 在 360/390/768/1440px 验证格式切换、理论总账不变、EP 轴变化、TP 容量变化、DP 复制与重载；完整浏览器回归共 143 次宽度检查通过，无页面运行时错误。人工查看移动和桌面截图。未改变周报模型、API 配置、Git 凭据或新闻工作区；上线仍等待仓库写入权限恢复。

## 2026-09-16：Kimi 权重口径核对与真正进入总账的混合精度

用户提出六项新增要求：核实权重准确性、扩展并行策略、模块级混合精度、按热度排序、降低界面密度和逐 rank 配置联动。本批先处理权重统计口径与模块级混合精度；不把上一阶段的验收当作本次完整目标已经完成。

### Kimi：不能混用文件体积、图示小计与部署显存

官方[文件目录](https://huggingface.co/moonshotai/Kimi-K3/tree/main)当前显示约 1.56 TB；这是完整仓库文件展示值，不是精确的权重张量清单字节，更不是单卡运行显存。[官方配置](https://huggingface.co/moonshotai/Kimi-K3/raw/main/config.json)声明专家 MXFP4，group 32、UINT8 scale，并排除 Attention、shared experts、Dense MLP、LM Head、视觉塔等模块的量化。

当前图示 Decoder 的 TP1 全部统一 4-bit 可复现值是 1,388,567,822,128 B（1.389 TB / 1.263 TiB），尚未复现用户反馈的 1.14 TB。已请求对应链接或截图，不能把未复现的数字直接认定为某一公式错误。页面此前虽在底部说明排除项，但大额小计仍容易被读成完整模型体积；现将统计范围与 TB/TiB 区别提前到结果之前。

新增可折叠核对卡，固定 TP1 对照同一批图示张量：2,777,135,644,256 个逻辑元素，其中 92 层 routed experts 为 2,722,740,830,208 个。给统一 4-bit 小计补上 UINT8/group-32 scale 的 85,085,650,944 B，再将其余图示张量从统一 4-bit 恢复 BF16，增加 81,592,221,072 B，得到 1,555,245,694,144 B。页面明确这只是控制变量对照：尚不含 Embedding、LM Head、视觉塔、文件元数据，也不是逐项验证的完整原生 dtype 清单。这个值接近官方四舍五入的 1.56 TB，不构成完整对账证明。

当前环境对官方 API/权重元数据下载发生连接关闭，索引 raw 地址仅返回约 59.8 MB 索引文件的 LFS 指针；未将指针大小当作权重体积，也未下载模型权重。完整 safetensors header / 文件清单核对仍待完成。

### 混合方案贯通逐 rank 与全部 Decoder

新增 URL 白名单 `precision=mixed`、`mlp`、`shared`、`experts`。GLM-5.2、GLM-5.3-Flash、Kimi-K3、V4-Flash 可分别选择 Dense MLP 和 Shared MLP 的 BF16/FP8，以及 routed 专家的 BF16、FP8、MXFP4、W4A8。Router 权重与 correction bias 固定 FP32，其他图示张量暂按 BF16 存储假设，不称为原生精度清单。V4 无 Dense MLP，因此禁用相应滑块并解释原因。

FP8 采用 E4M3 payload、128×128 block 和 FP32 scale；独立检查 gate/up 半区和输入分片的对齐。MXFP4 两值一字节，group 32，UINT8 scale。W4A8 明确指固定版本 [SGLang W4AFp8MoEMethod.create_weights](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/quantization/w4afp8.py)：INT4 权重、FP8 激活、group 128、FP32 weight scale，另加 gate/up [E_local,2] 和 down [E_local] 的 BF16 静态 input scale。它不是 MXFP4，也不是 NPU 的 W4A8 INT8 激活分支。不计 stride buffer、post-load 重排或转换峰值；不承诺当前检查点/硬件能直接使用任意组合。

`mixedWeightStorage` 作为逐 rank 和 Decoder 账本的共同计算入口。总量按 payload、weight scale 和静态 input scale 相加，不再统一乘一个位宽；模块占比按字节而非参数个数计算。EP 先分专家轴、MoE-TP 再分中间维，静态输入 scale 随本地专家数变化；DP 复制本地总量。配置对全部对应层生效，当前层没有所选模块时不伪造本层变化。混合模式隐藏不再生效的统一位宽滑块和旧独立专家对照，避免出现两个互不相干的“总量”。退出混合模式保留原统一位宽设置。

验收：原有 140 项模型测试与 4 项专家加载测试继续通过；新增 `npm run test:models:mixed` 的 4 项测试验证 Kimi 差额独立手算、W4A8 两类 scale、四模型所有层/TP/EP/格式的两账本一致性及 URL 校验。原有静态渲染套件通过，范围提示校验更新为前置的新文案。TypeScript、ESLint、生产构建与 276 份课程正文分包通过。Chrome 152 在 360/390/768/1440px 验证混合精度、Router FP32、物理 payload/input-scale Shape、Dense/Shared 控制互不误改、EP、重载与退出模式；完整回归 151 次宽度检查通过，无运行时错误，检查了移动与桌面截图。

剩余：完整原生权重清单和“1.14 TB”来源核对；将真实固定 dtype/图外模块纳入可审计的完整模型预算；更多 DPA/并行布局与混合精度结合；V4.1 模块精度；权威热度快照及排序；进一步折叠重排高密度内容；正常发布和线上验收。未改变新闻工作区、周报任务、模型账户或 Git 凭据；新目标保持进行中。

## 2026-09-16：可追溯热度排序与更紧凑的模型入口

19 个目录检查点增加 Hugging Face 模型页的公开 `Downloads last month` 快照，采集日期为 2026-09-16（Asia/Shanghai）。默认按近月下载降序，另可选择名称或原目录顺序。数据与来源仓库保存在 `src/data/model-popularity.ts`，卡片数字链接到对应官方模型页。当前前三项为 Qwen3-8B、Qwen3.5-9B、Kimi-K3。Base、Instruct 与不同尺寸不混用，也不累计第三方量化仓库或整个家族。

这是可审计的单一热度信号，不是综合影响力、模型性能或实时榜单。[HF 统计规则](https://huggingface.co/docs/hub/models-download-stats)按查询文件请求计数，包含 GET/HEAD，不等于完整权重下载或独立用户数。页面前置显示快照日期，详细口径默认折叠，满 30 天提示待更新。新条目缺少有效数据时排在已核对条目之后，不伪造为零；同分按名称和 ID 稳定排序。此次没有新增自动采集任务：刷新时须重新核对全部对应模型页的近月字段，同时更新日期，不能只改日期。没有读取站点访问量、用户资料或凭证，也没有浏览器端第三方统计请求。

目录卡片默认保留名称、公开下载数、标称参数、层数、上下文上限和打开/对比入口；架构层分布、说明和配置来源收进可键盘操作的详情。注意力筛选默认折叠，带有效架构筛选的链接自动展开。选中模型不会因搜索、筛选或排序丢失；清除筛选保留选项和排序。URL 新增白名单 `sort`，默认值省略，旧链接兼容，非法值带提示回退。

通用模型页用原生下拉选择替换横向长按钮条，18 个候选按相同快照排序；V4.1 仍通过完整目录进入其独立参考实现，未伪装接入通用计算。跨模型切换从第 0 层开始，保留目标模型支持的工作区、B/S、TP/EP、独立 DP、rank 和混合精度设置。对比页的 19 个候选同序，但不重排已经选定的对比位置。顺带修正全局配置摘要：混合模式显示“模块混合精度”，不再错误显示仍保留但未生效的统一位宽。

验收：144 项模型单元测试、4 项混合精度测试、4 项专家加载测试通过；130 组加载静态渲染及原有完整模型/目录/对比/V4.1/DPA 渲染套件通过。新增快照完整性、精确仓库版本、数字降序、同分、缺失/零值、非法数据、30 天边界、URL 往返、默认折叠和三种排序渲染检查。TypeScript、ESLint、生产构建与 276 份课程正文分包通过。Chrome 152 在 360/390/768/1440px 验证键盘展开、筛选、排序、选择保留、重载、模型切换与配置传递，完整回归 167 次宽度检查通过，无页面运行时错误；人工检查了移动与桌面截图。浏览器测试等待 React 路由对应的渲染结果，不把 URL 已变化误当作 DOM 已更新。

本批完成新增要求中的热度排序，并改善目录与模型选择的密度；不宣称完整权重审计、更多 DPA 或整个新目标完成。改动仅在独立模型分支，本次没有修改新闻工作区、周报任务、API 设置或 Git 凭据，也没有重复尝试已知无权限的推送。上线仍需恢复目标仓库写权限后正常推送并验证 Pages。

## 2026-09-16：DPA 与混合精度联动、全层小计及边界张量载荷

GLM-5.2 DPA 实验接入与普通模型页相同的 `mixedWeightStorage`，不另造一套位宽近似。Attention 权重先按 Attention-TP=TP/DP 分片，routed 专家按 EP 与 MoE-TP=TP/EP 分片，Dense/Shared 按总 TP 分片，然后分别计算所选格式的 payload、weight scale 和静态 input scale。Router/correction bias 在混合模式固定 FP32，其余未选择投影按 BF16 假设。统一位宽只保留作独立理论对照，在混合模式隐藏；退出恢复原设置。

URL 增加白名单 `precision`、`mlp`、`shared`、`experts`，沿用普通页格式枚举；不携带任意附加字段，非法模式或格式带提示回退。改变 TP/DP/EP、选 rank、请求组负载或当前层时保留混合方案。两页实验条件仍独立，不将普通页的“独立 DP 副本”冒充 DPA。

权重区新增当前层/本 rank、78 层/本 rank、78 层/全部卡三个小计。逐层聚合图示权重，包含前 3 层 Dense 与后 75 层 MoE，不因当前查看 Dense 而漏掉其他层的专家，也不因当前层是 MoE 而让 Dense 精度旋钮无效。各 rank 形状相同、分片内容不同，全卡值包含 DPA 的 Attention 复制，不是去重参数量。空闲组保留权重；当前层或请求负载不改变全层权重小计。

独立手算样例：TP8/DP4/EP4 时 Attention-TP2、MoE-TP2。W4A8 gate/up 的 INT8 payload 为 [64,2048,3072]，FP32 weight scale 为 [64,2048,48]，BF16 input scale 为 [64,2]，初始合计 427,819,264 B；down 为 [64,6144,512]、[64,6144,8]、[64]，合计 213,909,632 B。Router gate 256×6144×4=6,291,456 B，correction bias 256×4=1,024 B。EP 改变时 payload/weight scale 总量在此对齐基线保持不变，但每专家静态 input scale 数量随本地专家数变化，因此不能断言所有字节完全不变。

各权重展开项显示逻辑 Shape、存储容器 Shape、两种 scale 的 Shape/dtype、精确字节及份数。DPA rank 数据流另增加可折叠的四个 BF16 边界载荷：本组 Attention 有效输入、全局 FFN 汇合输入、FFN 合并后逻辑输出、返回本组的有效输出。TP8/DP4、请求 [3,1,0,2] 的 Decode/MAX_LEN 示例中，Rank5 属于空闲组，输入/返回为 [0,6144]、0 B，但全局 FFN 边界为 [16,6144]、196,608 B。四个边界可能别名或分时复用，不将它们相加成峰值或通信流量；T_e 仍由实际路由决定，A8 不自动将 BF16 模块边界减半。

本次通过直接读取固定版本 [W4AFp8 源码](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/quantization/w4afp8.py)复核了 `create_weights`，并确认 `process_weights_after_loading` 将 weight scale 转为 BF16 后重排，将 gate/up 与 down 的 input scale 分别归约成一个 FP32 标量。因此现有混合结果明确标为“初始权重分配”，不能叫作加载后常驻量。通用精度控件补充同一说明；加载后布局仍待独立建模，不能拿初始分配总和作 GPU 实际显存承诺。

所有汇总只含图示 Decoder，不含 Embedding、LM Head、KV、激活、stride buffer、转换峰值或最终 kernel 布局。DPA 基线与完整统计说明改为可展开内容，重要统计范围仍放在数字之前；移动端三个汇总卡改为两行，减少连续滚动。

Kimi 的公开模型元数据 API 再次只读检查仍在 TLS 建连时失败，未取得文件清单或完整 dtype 清单；没有用空响应、模型卡近似值或加载分配量冒充完整对账。Kimi 完整审计、加载后格式、更广 DPA/V4.1 模块混合、后续页面精简及正常上线仍未完成；目标保持进行中。周报任务、API 配置、Git 凭据与原新闻工作区未改变。

验收：148 项模型单元测试、4 项通用混合精度测试、4 项专家加载测试通过。新增 DPA 单元测试覆盖 240 个拓扑/模块格式组合，含独立手算、与 DP=1 普通 Decoder 账本逐层及全层一致、Dense/Shared/Routed 控制互不误改、EP 静态 input scale 数量、空闲组 BF16 载荷和 URL 白名单。48 个混合 DPA 静态渲染组合及原有完整渲染套件通过。TypeScript、ESLint、生产构建与 276 份课程分包通过。Chrome 152 在 360/390/768/1440px 完整回归共 179 次宽度检查通过，无页面运行时错误；实际操作验证格式滑块、Router FP32、物理 Shape/scale、DPA/EP 改参、当前层不改变全层总量、载荷范围、重载和退出混合模式，检查移动及桌面截图。没有执行 GPU/NPU 推理或峰值显存测量。

## 2026-09-16：W4A8 初始与后处理布局、运行元数据去重

继续逐行核对固定版本 [W4AFp8MoEMethod](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/quantization/w4afp8.py) 的 `create_weights`、`interleave_scales`、`process_weights_after_loading` 与普通 `apply`。此次将已确认的后处理真正接入数值，不再只停留在初始分配警告。

混合控件新增 W4A8 阶段：初始分配或后处理。INT8 容器的 payload Shape/字节不变；weight scale 从 FP32 转 BF16，原 [E,O,G] 重排为 [E,G/a,O×a]，G 能被 4 整除时 a=4，否则 a=1。gate/up 的 [E,2] BF16 input scale 和 down 的 [E] BF16 input scale 各归约为一个 [1] FP32 张量，不能继续按专家数乘 4 B。每个独立矩阵副本各保留一个标量，不将 multiplicity 遗漏。

例如 E=64、gate/up O=2048、H=6144 时，payload [64,2048,3072] 不变，weight scale [64,2048,48] FP32 变成 [64,12,8192] BF16，input scale [64,2] BF16 变成 [1] FP32。该项权重与 scale 从 427,819,264 B 降为 415,236,100 B。Kimi TP8/EP1 的 down 分片 I=384、G=3，不可套四路重排，后处理 scale 为 [896,3,3584]，而不是错误整除后的分数维度。

`mixedWeightStorage` 返回实际所选阶段的 scale Shape、dtype、字节，并保留同一张量的初始分配字节供展开对照。四个已核对通用模型及 GLM-5.2 DPA 共用此入口；本层、全部 Decoder、TP 组和独立 DP 副本总账一起变化。Router FP32、Dense/Shared、其他格式、逻辑参数 Shape、DPA 的 BF16 边界与 KV 不随 W4A8 阶段变化。URL 白名单增加 `w4stage=processed`；旧链接默认初始分配，非法值带提示恢复，退出混合模式移除字段。切换到其他专家格式时保存但不应用 W4A8 偏好，相关控件与元数据面板隐藏。重复点击已选混合模式不再重置精度设置。

新建共用权重展开组件，避免普通 rank 与 DPA 对同一 scale 显示不同 dtype。重要范围仍在总账之前：只对 W4A8 专家采用该固定版本后处理，其余模块仍按所选存储假设；不是完整原生 checkpoint 清单或硬件部署支持证明。W4A8 的 INT4/FP8 语义与 NPU W4A8 INT8 激活仍明确区分。

运行元数据独立列出，不混入“权重与 scale”小计。该 method 保存四个 [E,3] INT64 stride 张量、一个 [E+1] INT32 expert_offsets 和两个 [E,3] INT32 problem_sizes，共七个独立分配，大小为 4×E×3×8 + (E+1)×4 + 2×E×3×4 = 124E+4 B。b_strides1/a_strides1、s_strides13/c_strides1、b_strides2/a_strides2、s_strides2/c_strides2 是四对存储别名，不能计成十一份分配，更不能按 gate/up 与 down 各加一套。E64 为 7,940 B，Kimi E224 为 27,780 B；按实际本地专家数与卡数联动。默认折叠，展开显示每项 Shape、dtype、字节和别名。它们在初始与处理后均存在；这里不宣称覆盖 kernel 临时 workspace、allocator 或转换峰值。

Kimi 元数据另有可复用证据：[官方 raw 索引指针](https://huggingface.co/moonshotai/Kimi-K3/raw/main/model.safetensors.index.json)给出索引本身 59,764,096 B，SHA-256 为 `a1c5210650ce71d2d3ae9ec5a101ac4afd3cf4b10091be589853437eb967febd`。这不是模型权重大小。尝试经公开镜像获取并按官方 SHA-256 验证同一索引，但镜像重定向后的官方 CDN 仍发生 TLS 连接失败，读取 0 B，未通过哈希验证；没有解析或信任未经校验的内容，也未下载权重。完整原生清单仍待获取。

验收：148 项模型单元测试、7 项混合精度测试、4 项专家加载测试通过；四模型全层/TP/EP/副本一致性回归新增 W4A8 后处理分支。新增手算覆盖 G=1/2/3/4/8/12/28/48、独立副本标量数、七个分配与四个别名、普通/DPA URL 往返及阶段改变只影响专家。36 个新增通用/DPA 阶段渲染组合，以及原有 48 个混合 DPA、130 个加载和完整模型渲染套件通过。TypeScript、ESLint、构建及 276 份课程分包通过。Chrome 152 的 360/390/768/1440px 全部通过，191 次宽度检查无溢出，无页面运行时错误；验证总账更新、Dense 当前层不变、TP/EP 改变 scale 轴、G=3 分支、元数据别名、重载、恢复初始与退出模式，并检查移动/桌面截图。没有进行 GPU/NPU 推理或峰值显存测量。

本批尚未完成 Kimi 完整 checkpoint 对账、其他格式最终布局、V4.1 模块混合与正常上线等剩余工作，不标记整体目标完成。原新闻工作区、周报模型、API 设置与 Git 凭据未改动，未重复尝试已知无权限的推送。

## 2026-09-16：Kimi 原生 checkpoint 全量元数据审计

解决之前官方 HF CDN 的读取障碍：Moonshot 官方 ModelScope 仓库可访问，索引内容的 SHA-256 与 HF 官方指针一致。按逐文件固定 commit，仅读取 96 个分片的长度前缀与 JSON header，完整覆盖 497,220 个张量，逐项验证 dtype、shape、offset、分片归属、无重复/缺失及末尾边界。载荷总计精确等于索引 total_size。生成器拒绝 Range 请求返回的 200 全文件响应，设置每头/总体字节上限和并行度，仅输出白名单元数据。实际读取约 135.5 MB 元数据，不下载或哈希验证 1.56 TB 的权重载荷。

完整文件精确为 1,560,936,091,448 B，张量载荷为 1,560,860,324,864 B，文件头与长度前缀共 75,766,584 B。原生 Decoder 为 1,555,267,943,424 B；其余 Embedding、未绑定 LM Head、视觉塔/投影、输出 Norm/AttnRes 共 5,592,381,440 B。Router gate.weight 原生存为 BF16，correction bias 与 KDA 卷积/A_log/dt_bias/o_norm 存为 FP32，不再将“MXFP4 专家 + 其余 BF16”误当原生清单。

从旧控制变量方案 1,555,245,694,144 B 到原生 Decoder 的差额为 22,249,280 B：原生 FP32 相对 BF16 多 22,244,864 B，加上 checkpoint A_log [128] 与 SGLang 运行时 96 heads 的 BF16 基线差 4,416 B。A_log 的运行时裁剪有固定版本源码依据，保留图示逻辑元素统计，不用原生 [128] 覆盖运行时 [1,1,96/TP,1]。详细证据、算式、复现方法和边界见 [Kimi checkpoint 审计](kimi-checkpoint-audit.md)。

页面默认三张卡区分统一 4-bit 理论值、原生 Decoder、完整文件值。精确差额、模块/dtype 明细、审计方法三个部分分别折叠，支持键盘展开；完整文件总量不随当前 TP/EP/自定义精度改变。原生 MXFP4 packed 与 scale 形状明确列出，U8 容器不冒充逻辑 8-bit 权重。审计不是部署显存估算，不能直接除 TP；未复现反馈中 1.14 TB 的旧配置，不声称那个问题已完全复现。

验收：148 项模型单元、7 项混合精度、4 项专家加载、4 项新增 checkpoint 审计测试全部通过；新增独立专家 packed/scale 手算、精确各级汇总、原生 dtype/shape、索引身份，以及错误状态/Range/长度/截断/超限、非法 dtype/shape/offset、错分片等拒绝路径。36 个 W4 阶段、130 个加载及完整模型/目录/对比/V4.1/DPA 静态渲染通过。TypeScript、ESLint、生产构建、276 份课程分包通过。Chrome 152 在 360/390/768/1440px 共 203 次宽度检查通过，无运行时错误；新增三个审计展开区的精确数字、原生 shape、来源与验证边界检查，人工检查移动与桌面截图。

下一步仍需原生加载后逐 rank 全模型分配与更多 DPA/混合格式等剩余要求，整体目标保持进行中。未进行 GPU/NPU 推理，未改周报/API/Git 认证，未触碰原新闻工作区。未重复尝试已知无写权限的推送；这些新增功能仍仅在本地独立模型分支。

## 2026-09-16：Kimi 全模型原生初始参数与 rank 分片

在完整 checkpoint 审计上继续前进，新增消费全部 216 组模板的原生加载账本，不再只按图示 Decoder 推测完整模型。固定 CUDA SM100 / FlashInfer MXFP4、模型默认 BF16、PP=1、A2A=none、无 DPA/EPLB/冗余专家，计算阶段明确为后处理前。主页面 TP/EP/独立 DP 与 rank 控件直接驱动该账本；自定义 MLP/专家精度不改变官方原生格式。

基于固定版本 Kimi 构造和 loader、MoEGate、FusedRMSNormGated 与 MXFP4 create_weights：A_log 从文件 [128] 裁剪为 96 heads 再 TP 分片；o_norm 从文件 F32 转为默认 BF16 参数；Router 权重仍为 BF16（CUDA logits 为 FP32），不要因输出为 FP32 就把权重存储乘 4。Attention 低秩输入投影和 Norm 复制，head 投影按对应 OUT/IN 轴切分；Dense/Shared 按完整 TP，routed 的专家份数除 EP、内部轴除 MoE-TP。Embedding/LM Head 按词表轴 TP 划分；视觉塔/投影包括视觉 MLP 全部复制，不误套文本 MLP 规则。详细来源与独立算式见 [审计说明](kimi-checkpoint-audit.md)。

MXFP4 create_weights 在 CUDA 为无 bias 的原模型也创建两个 BF16 零 bias。列出实际 w13/w2 的 packed、scale、bias 六个初始容器，前四项与源张量分片按元素/字节守恒，不重复相加。额外 bias 为 92×(896/EP)×(2I+3584)×2 B，I=3072/(TP/EP)。这些尺寸在 SM100 FlashInfer 的 128 对齐下不需填充。TP1 初始全模型参数为 1,562,464,095,360 B；TP8/EP1 为 206,668,769,776 B，TP8/EP8 为 206,151,756,272 B。固定 TP 的两种 EP 条件中，checkpoint 映射载荷相同，初始参数差 517,013,504 B 来自零 down-bias 数量，不是对专家权重重复除 EP。

界面在 Kimi 对账区提供折叠的原生加载基线，展示当前 rank、EP 专家区间、MoE-TP 分片区间、rank/TP 组/全副本小计，模块选择及按需展开的源 dtype/shape→本地 dtype/shape/份数。单独显示六个实际专家容器；其他源张量不冒充 QKV 等最终融合布局。独立 DP 只复制整个 TP 组，改变 rank 不改变等形本地字节，只改变源数据归属。总计显式不含后处理转型、派生参数、MLA 副本、缓存、workspace 和转换峰值；未测试 GPU 推理。

新增单元测试用独立逐模块算式验证全部 TP/EP/独立 DP 组合、复制视觉 MLP、A_log/o_norm、原生 BF16 Router、六个融合容器守恒、源区间、零 bias 与无效拓扑；40 个新增 SSR 组合验证主页面实际接线及不受混合格式误改。共 168 项单元测试、原有混合/专家加载与完整静态渲染回归通过；TypeScript、ESLint、生产构建及 276 份课程独立分包通过。Chrome 152 在 360/390/768/1440px 完整交互回归共 219 次宽度检查通过，无运行时错误；新增原生展开、精确字节、六容器 shape、TP/EP/DP/rank 改参、Router BF16、A_log head 区间、URL 重载与 TP1 收敛检查，并人工查看移动/桌面截图。

仍需完成原生后处理账本、更广 DPA/模块混合与正常上线；目标未完成。未改新闻工作区、周报任务、API 配置或 Git 认证，也未重复已知无权限的推送。

## 2026-09-16：原生后处理持久张量与滑块往返修复

继续读取固定 SGLang `96d91ef` 的 MXFP4 method、Kimi post-load、AttnRes cache，并核对其 pyproject 固定的 FlashInfer 0.6.18 行置换/cache 实现。原生加载区增加初始/后处理阶段选择，后处理明确称为“已核对持久张量小计”，不冒充完整 GPU 常驻量。URL 白名单 `native=processed` 独立于自定义 W4A8 的 `w4stage`，TP/EP/独立 DP/rank 与层号变化保留阶段；切换到其他模型不泄漏 Kimi 专属字段。非法阶段给出提示并回退。

MXFP4 后处理保留 packed/scale 字节量，但重排行次与 scale block；scale 保存为 float8_e4m3fn view，仍承载 UE8M0 字节，不是数值换成 E4M3。两个 bias 替换成 FP32，并新增三个 [本地专家数] FP32 的 gemm1 参数，共九个参数容器。其余原生参数保持同一基线，不把初始和替换后 bias 相加。逐专家和逐层数都随 EP/MoE-TP 联动。

额外记录 MLA w_kc/w_vc 的独立存储、187 份 BF16 与 187 份 FP32 AttnRes combined weights、每设备六个 I64 行索引 cache。索引由层与专家共享，且 FlashInfer 和 SGLang 的两个字典引用同一 device Tensor，不能再乘 92 或 E，也不能算两套。合并 MoE front、KDA f_a/b 只重新指向 views，原完整权重不重复计数；TP8 的 f_a/b 总宽 140 需补四行，只增加 3,956,736 B padding。TP8 另有匹配固定 fused KDA shape 的卷积转置副本、零 bias 与 FP32 o_norm，A_log reshape 是别名。具体形状、字节、版本来源和边界记于 [Kimi 审计说明](kimi-checkpoint-audit.md)。

TP8/EP8 的后处理参数为 206,352,354,544 B，已核对持久缓存与 padding 为 94,124,544 B，合计 206,446,479,088 B。TP8/EP1 对应 207,481,242,608 B；TP1 对应 1,564,681,137,280 B。dispatcher、其他后端 workspace、KV/激活、CUDA Graph、allocator 与转换峰值仍未覆盖；未运行 GPU 推理，不将未知项设为零。

浏览器回归发现并独立复现一个真实操作问题：EP8 随 TP 缩至 1 后，浏览器将 range.value 自动截断成 0，但 React 18 的 value tracker 仍为旧的 3；再扩展 TP 后第一次 End 把 DOM value 改成 3，却被认为“未改变”，URL 和账本仍停留 EP1。单纯等待重新渲染不能修复。现在在合法选项范围变化时重建 EP range，使浏览器值与 React 追踪同步；GLM DPA 的 DP/EP range 同样处理。选项不变时不重建，不打断连续拖动。回归保留 TP8/EP8→TP1→TP8→首次 End，以及 DPA DP/EP 往返，直接检查 URL、控件与计算结果一致。

171 项单元测试、80 个原生阶段 SSR 组合及既有完整模型/目录/对比/V4.1/DPA/混合/专家加载静态渲染通过；TypeScript、ESLint、构建和 276 份课程分包通过。Chrome 152 在 360/390/768/1440px 全量交互回归共 235 次宽度检查通过，无运行时错误；验证初始/后处理切换、scale view、派生张量与别名、URL 重载，以及 TP/EP 和 DPA DP/EP 缩小再恢复后的首次操作，并人工查看移动与桌面截图。整体目标仍进行中，其他模型/并行与正常上线尚未完成；原新闻工作区、周报、API 和 Git 认证未改变。

## 2026-09-16：Qwen3-8B Dense 混合精度与融合视图

针对目录热门 Dense 模型补齐按模块精度：Qwen3-8B 的全部 36 层 MLP 可选择 BF16 或 FP8 block 128×128，Attention 与 Norm 保持 BF16。现混合方案覆盖五个通用模型，GLM-5.2 DPA 另列。限定已核对模型的角色解析新增 `ffn` → MLP，不将任意模型名称自动推广为支持。纯 Dense 控件只显示有效 MLP 滑块，不显示不存在的 Router/Shared/Routed/W4A8 阶段；链接恢复清除不适用专家配置且提示，保留 Dense 精度。

核对官方 Qwen3-8B config 和固定 SGLang `96d91ef` 的 Qwen3、Qwen2MLP 与 Fp8LinearMethod。Qwen3 复用 MergedColumnParallelLinear 的 gate_up 与 RowParallelLinear 的 down。新增按需展开的融合布局与 FP32 scale 形状、精确字节，和原图 Gate/Up 两矩阵账本按元素守恒，不重复计数。FP8 block 在该版本要求预序列化 FP8 checkpoint 与 dynamic activation；明确不是直接给原 BF16 checkpoint 加启动参数即可得到此布局，未运行 GPU。初始分配与后端后处理边界不混淆。

Qwen3 每层的 post_attention_layernorm 原本已由公共 Decoder 生成，不能因模型配置文件中未显式列出而重复加一份。新增独立逐项算式验证两套层 RMSNorm 与 Q/K Norm 共 16,896 B/rank，Attention 矩阵 83,886,080/TP B；MLP 全 BF16 为 301,989,888/TP B，FP8 payload 加 scale 为 151,031,808/TP B。TP8 的 MLP 为 18,878,976 B；36 层 Decoder 在仅 MLP FP8 情景下为 1,057,738,752 B/rank（不含 Embedding/LM Head），Norm 复制不除 TP。独立 DP 复制整个 TP 组，不缩小本地权重。详细表与来源见 [Qwen3 核对说明](qwen3-dense-precision.md)。

逐 rank 展示新增合并投影 [N,2I/TP]、SiLU(Gate)×Up [N,I/TP] 与 Down 部分和 [N,H]，随 TP、batch、Prefill/Decode 联动。测试覆盖全部 TP、两种 MLP 精度、四种副本数及两阶段，检查当前模块与 36 层总账一致、融合前后守恒、没有静态 input scale 和专家选项对 Dense 总账无作用。

本轮 173 项单元测试全部通过，混合精度/生命周期 SSR 从 36 扩为 44 例，原完整模型/目录/比较/V4.1/DPA/专家加载/80 例 Kimi 原生阶段静态渲染通过。TypeScript、ESLint、生产构建及 276 份课程分包通过。Chrome 152 四屏宽 360/390/768/1440px 全量交互回归共 247 次宽度检查通过，无运行时错误；人工查看 Qwen 融合视图移动与桌面截图。整体目标继续进行，更多 DPA/混合布局与正常上线仍未完成；原新闻工作区、周报、API 和 Git 认证未改变。

## 2026-09-16：GQA / Dense 的 DP Attention

将 DPA 的模型范围明确扩为 GLM-5.2 与 Qwen3-8B 两个白名单，保留默认 GLM API/路由，不自动启用所有 GQA 模型。Qwen 新路由 `/models/qwen3-8b/dpa` 从普通模型页进入；两种 DPA 页面间可切换，恢复目标模型默认条件。按各自层数与上下文校验 URL，Qwen 固定无 EP，删除不适用专家格式；复制状态按模型与参数共同标识，避免跨模型误称已复制。

固定 SGLang `96d91ef` 的 Qwen3Attention 使用 Attention TP 的 QKV/O；Qwen2MLP 用总 TP 的合并 Gate/Up 与 Down。DPA 下 Dense 中间维不随 DP 再缩小，Norm 保持复制。Qwen Down 默认完成总 TP 归约，LayerCommunicator 未打开 allow_reduce_scatter，后续 dp_scatter 只取本地 global buffer 的本组区间；页面不沿用 MoE 的融合归约描述。固定无 CP、LayerNorm SP、Dense fully-DP、图捕获与通信量化等特殊分支。

GQA 与 MLA 的 KV 必须分开：Qwen 的 8 个 KV heads 在支持的 Attention TP≤8 范围内完整分片，单层缓存 [B_group,S,2,8/AttentionTP,128]，乘 36 层和每元素字节。全卡 KV 对同样数量请求保持不变，不能照搬 GLM MLA 的整套 latent 复制/随 DPA 缩减口径。TP8/DP4、请求 [3,1,0,2]、S128、2 B 时，各 rank 为 [27,27,9,9,0,0,18,18] MiB，全卡 108 MiB；空闲 rank 仍持有全部本地参数。

新增折叠的 QKV 与 Dense 内部逻辑张量及字节，区分本组有效行和 MLP 全局补齐行；Q/K/V 是 QKV 视图，不重复相加。已有 Qwen 融合布局接受 DPA buffer 行数，不再把 DPA 情景的 N 错写为普通独立副本 batch。完整公式、固定来源与边界见 [GQA-DPA 核对](qwen3-dpa.md)。

177 项单元测试、40 个新增 Qwen DPA SSR 路由及既有完整模型/目录/对比/V4.1/GLM-DPA/混合/专家加载/Kimi 原生静态渲染通过。TypeScript、ESLint、生产构建和 276 份课程分包通过。Chrome 152 在 360/390/768/1440px 全量交互复验共 267 次宽度检查通过，无运行时错误，并人工查看移动与桌面截图。首次全量的 1440px TP 往返检查曾因只等待原本已为 1 的 DP 值而越过尚未提交的 TP 导航；改为明确等待 TP 值和 DP range 边界后，独立 20 次往返与完整复验通过，没有据此改动已正确的控件算法。整体目标未完成；更多模型的并行/混合布局及正常上线仍待推进，未修改原新闻工作区、周报、API 或 Git 认证。

## 2026-09-16：按范围阅读权重，精简多副本界面

针对“信息不要太密集”和统计范围混淆，本轮不新增数值假设，调整既有数据的阅读顺序。权重工作区提供三个定位入口：当前 rank 的当前模块、整个 Decoder/所有副本、Kimi 官方文件与原生加载。入口使用按钮滚动并聚焦可访问的 section，不改 HashRouter 的 URL、数值配置或历史记录；支持键盘 Enter。

独立 DP 由一次展开全部 replica×TP 张卡改为先选副本，再显示该副本的 TP rank 按钮。切换副本保留 TP local 坐标；从 rank 或 URL 反推当前副本，没有新增脱离 URL 的选择状态。全部 rank 都可通过副本选择与 TP 按钮访问，缩小 TP/副本后的范围校验沿用既有逻辑；不把其他副本的权重或请求排除出计算。Dense 模型明确说明 EP 不适用，而不是提示未核对一个并不存在的专家布局。

当前模块的小计移至输入输出附近，新增精确 B；Decoder 三张总量卡改为本层每卡、全部层每卡、全部层所有 TP/DP 副本，统一使用字节及可读单位。原“全局去重元素数”保留在计算规则中，并注明它不是单卡字节，避免三张卡混用元素和字节。图示 Decoder 非完整模型、非部署显存的警告保持直接可见。

Kimi 的 96 文件总量 1,560,936,091,448 B 与“不随 TP/混合精度改变、不是 rank 显存”的说明仍直接展示；三档对比卡、差额、dtype 明细和来源折叠到审计说明中。原生初始/后处理入口不放进这个折叠层，仍可独立访问。EP 执行条件、专家通信组、逐专家路由上界与跨层累加规则按需展开；来源、边界、公式均保留。

用同一生产预览、Chrome 152、Kimi Layer3/TP8/EP8/8 副本/Rank63、混合 W4A8 初始情景测量默认关闭详情的高度（px）。这是对照样本，不是所有模型的固定比例或性能指标：

| 屏宽 | 权重工作区：前 → 后 | rank 面板：前 → 后 | 文件核对区：前 → 后 |
| --- | ---: | ---: | ---: |
| 360 | 8,415 → 6,366 | 4,526 → 3,073 | 720 → 252 |
| 1440 | 4,649 → 3,558 | 2,780 → 1,913 | 396 → 192 |

该情景默认 rank 按钮由 64 个降为 8 个，360px 工作区高度约减少 24%。新增 96 个 SSR 组合验证三个模型的全部 TP/副本数、首尾 rank、可达副本选项、精确分范围字节、焦点目标与默认折叠状态。浏览器新回归逐一切换全部八个副本，检查同 TP 坐标、rank 列表、冻结总账、键盘定位不改 URL 与重载；既有跨副本和 Kimi 展开测试同步改为真实的新操作路径，不绕过 UI。

177 项数值单元测试、既有完整静态渲染与新增 96 个阅读布局渲染通过；TypeScript、ESLint、生产构建及 276 份课程分包通过。Chrome 152 在 360/390/768/1440px 全量交互复验共 279 次宽度检查通过，无运行时错误；覆盖全部八个副本的 rank 可达性、保留 TP 坐标、分范围总账不变、键盘定位与 URL 重载，并人工查看移动端对账和桌面 rank 截图。本轮未改变计算函数、新闻工作区、周报、API 或 Git 认证；整体目标仍在进行，尚未上线。

## 2026-09-16：普通 rank 的逻辑张量载荷

普通 rank 工作区此前只有输入/输出 Shape 与权重字节，DPA 虽有边界载荷，普通 TP/独立 DP 工作区缺少同类的教学读数。现为格式化后的模块边界增加逻辑元素数，非缓存模块同时显示明确标记的 2 B/元素参考载荷（例如 BF16）。这不是实际 dtype 检测，不跟随权重 4/8/16/32-bit、自定义混合格式或 KV 位宽改变，不能把 W4A8 权重的 4-bit 错用到模块输出上。

内部张量仅展示每个所列 Shape 的元素数，不从名称推断 dtype、K/V 份数或整数索引的字节。当前 rank 选择器仍限于 Decoder 模块；缓存、Kimi FP32 递归状态等仍在缓存工作区按既有格式独立核算，新参考不覆盖其字节。组件也禁止给 memory 模块套用统一 2 B 参考。动态专家 T_e、箭头、斜杠与附注不猜测；返回未知而非 0。显式零轴可得到 0 元素；带 + 的输入按各操作数计元素，并说明这不是新分配的拼接张量。所有输入输出和内部 views 都不合计为运行时峰值。

新增独立纯解析器只接受非负安全整数、轴乘积与显式操作数相加，不执行表达式，不复用权重解析器的斜杠规则；元素和参考字节都检查安全整数边界。既有权重、缓存、并行分组与 URL 算法未改。

Qwen3-8B 独立算式覆盖 TP1/2/4/8、独立 DP1/2/4/8、Prefill/Decode：B=3、S=1024 时，Prefill N=3072，输入输出均 12,582,912 元素，2 B 参考 25,165,824 B；Decode 各 12,288 元素、24,576 B。Gate/Up 合并输出元素为 N×24576/TP，SiLU 为 N×12288/TP；Down 的 [N,4096] 不再除 TP。Kimi Layer3 的 MoE 主干边界宽度 7168，不误用 routed latent 3584；EP 和独立副本不缩小本地输入。新增全目录边界安全性检查及渲染/浏览器断言。

181 项单元测试、完整模型/混合/专家加载/Kimi 原生静态渲染、96 个阅读布局渲染、TypeScript、ESLint、生产构建与 276 份课程分包通过。Chrome 152 在 360/390/768/1440px 全量交互复验共 287 次宽度检查通过，无运行时错误，并人工查看移动/桌面载荷截图。覆盖 TP 与 MLP 精度切换后的边界读数不变、内部投影元素随 TP 改变、Prefill 增长、URL 重载与 Kimi bank 附注不推断。新浏览器用例最初误用普通页面不支持的 S=128，已改为合法 S=1024 并检查 URL；未改变原有序列范围。本轮不改变新闻工作区、周报或认证，整体目标未完成，功能仍只在本地。

## 2026-09-16：Qwen3-30B-A3B 的 EP 与混合权重

核对官方原版配置与固定 SGLang `96d91ef` 的 Qwen3MoeSparseMoeBlock、Attention 和 FusedMoE，补齐该已有模型的 EP 能力。128 个 routed 专家、Top-8、48 层，中间维 768，hidden 2048；Gate/Up 与 Down 明确标记专家轴，Router 复制，Attention TP 不随 EP 改变。TP8 的四个 KV heads 仍各复制到两卡，没有将 expert 并行误用于 KV。

该模型没有 Dense 或 Shared MLP，精度区域只显示 Routed MoE。新增几何约束：FP8 block/W4A8 group 的 128 对齐只在 MoE-TP=1/2 满足，MoE-TP=4/8 时只显示 BF16/MXFP4。解析非法链接或收缩 EP 时明确提示并回退 routed BF16，不默默改变拓扑；放大 EP 后用户可重新选择。合法选项变化时重建 range，防止浏览器自动夹取后的 React 值追踪不一致。已有模型的合法集合不变。

混合 Router FP32 是用户请求的自定义情景，明确区分官方与普通 SGLang BF16 Router；没有 correction bias 不额外添加。48 层总量、各 rank 与图示清单沿用同一存储函数，W4A8 初始/后处理 scale 和独立运行元数据均可查看。具体几何、每格式独立公式、示例字节、固定源码和无 padding/无特殊 runner 边界见 [核对说明](qwen3-moe-precision.md)。新模块内部张量展示 Router、Top-8 编号/权重及 Q/K/V，延续不猜 dtype 和不假设均匀路由的规则。

184 项单元测试通过；混合/生命周期静态渲染增至 124 例（新增 80 例 Qwen MoE），专家加载静态渲染 140 例及其他完整静态回归通过。TypeScript、ESLint、生产构建与 276 份课程分包通过。Chrome 152 在 360/390/768/1440px 最终全量回归共 299 次宽度检查通过，无运行时错误；验证 EP8→EP1→EP8 的格式约束、首次滑动、初始/后处理字节与 Rank15 重载。人工查看移动/桌面截图，并将重复的对齐说明折叠，使用无 Dense/Shared/correction bias 的模型专属文案。本轮未修改新闻工作区、周报、API 或 Git 认证；整体目标继续进行，新增功能未上线。

## 2026-09-16：Attention head 的逐 rank 归属

补充 Llama-3.1-8B、Qwen3-8B 与 Qwen3-30B-A3B 普通 TP 的 Q/K/V head ID、KV 复制 peers 和逻辑投影矩阵行/列区间。固定 SGLang QKVParallelLinear 的加载规则：Q shard ID 为 TP rank；K/V shard ID 为 KV TP rank 整除复制倍数。限定已核对的三模型普通基线，不套用到 MLA、DPA、全量 QKV 汇集或其他混合后端。

逐 rank 面板仅在 GQA 模块显示一个默认折叠的摘要，展开后只列当前 DP 副本，不重新铺开全部卡。Rank 或副本切换同步更新 head 范围、矩阵区间与表格高亮；TP 改变重新分片，EP 不改 Attention。Qwen3 MoE TP8 的 Rank15 持有 Q28–31、KV3，与当前副本的 Rank14 共享 KV head，不跨到另一个副本；不同请求不能因为 Shape 相同就认为激活值相同。详细公式、来源与边界见 [head 归属说明](attention-head-ownership.md)。

新增三项独立单元测试验证所有 TP/副本的完整 Q 分区、KV 复制倍数、Q/KV 分组关系与投影权重元素数；初始测试将 Llama 分列的 K、V 与 Qwen 合列清单混为单行，已改为对两种表示都明确合计 K+V，不改原有正确的权重计数。187 项单元测试、全部静态渲染及扩为 128 例的阅读布局检查通过，包含默认折叠与当前副本行数。TypeScript、ESLint、生产构建及 276 份课程分包通过。Chrome 152 在 360/390/768/1440px 全量回归共 311 次宽度检查通过，无运行时错误；验证 head 表格的键盘展开、Rank15→14、副本切换、EP 不影响归属、TP 收缩与 URL 重载，并人工查看移动/桌面截图。未改新闻工作区、周报、API 或 Git 认证，目标继续进行，尚未上线。
