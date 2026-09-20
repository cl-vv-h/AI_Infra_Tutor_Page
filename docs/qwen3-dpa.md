# Qwen3-8B：GQA 的 DP Attention 核对

核对日期：2026-09-16。页面路由 `/models/qwen3-8b/dpa`，与 GLM-5.2 DPA 并存；模型间切换恢复目标模型默认条件，不把 GLM 的 MLA、Indexer 或 MoE 规则套到 Qwen。

## 固定源码与执行边界

固定 SGLang `96d91ef9266d2bebd8e8c09ef1f28b2d521631ff`，采用 eager 基线：总 TP=1/2/4/8，Attention DP 整除 TP，Attention TP=TP/DP；PP=CP=1，Dense MLP 使用总 TP。没有 EP（模型没有专家），不启用 Dense fully-DP、LayerNorm SP、确定性 RL 特殊分支、CUDA Graph、Gatherv、通信量化或两批重叠。未启动 GPU 推理，不宣称性能提升或硬件部署可行性。

- [Qwen3Attention 与 Decoder](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/models/qwen3.py)：QKVParallelLinear 和输出 RowParallelLinear 显式使用 `attn_tp_rank/size`；Q/K heads 按 Attention TP 划分；Q/K Norm 是每 head 共享的 [128] 向量。Decoder 使用 `is_layer_sparse=False` 的 LayerCommunicator。
- [Qwen2MLP](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/models/qwen2.py) 与 [Linear](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/linear.py)：Gate/Up 合并列并行、Down 行并行，未覆盖 tp_size，使用总 TP；Down 默认 `reduce_results=True`。
- [LayerCommunicator](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/communicator.py)：此基线的 Dense MLP 为 FULL，Attention 与残差为 TP_ATTN_FULL。Qwen 没有设置 `allow_reduce_scatter=True`；Down 归约后的全局结果通过 `dp_scatter` 取回本组，并非再次做跨卡 ReduceScatter。
- [DP Attention](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/dp_attention.py) 与 [ForwardBatch](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/model_executor/forward_batch_info.py)：按 Attention TP 对齐 token 数，再选择 eager MAX_LEN/SUM_LEN；DP>1 的完整 Prefill 使用 SUM_LEN，Decode 在 2×SUM≥DP×MAX 时使用 MAX_LEN。`dp_scatter` 是从本地 global buffer 复制本组区间，不是同名的跨卡 collective。

尺寸及 FP8 初始分配来源和限制沿用 [Dense 混合精度说明](qwen3-dense-precision.md)。FP8 情景只改变 MLP，Attention 和 Norm 为 BF16；必须准备符合约束的 FP8-serialized checkpoint，不是现场转换或原生 checkpoint 清单。

## 权重：Attention 与 Dense 使用不同分片宽度

令 t=总 TP、d=Attention DP、a=t/d：

- Q [32/a×128,4096]；K/V 各 [8/a×128,4096]；O [4096,32/a×128]。BF16 Attention 矩阵合计 83,886,080/a B/rank/layer。
- 两套层 RMSNorm 与 Q/K Norm 共 16,896 B/rank/layer，复制不除 a 或 t。
- Dense MLP BF16 301,989,888/t B；FP8 payload + FP32 block scale 151,031,808/t B。DPA 不改变 t，MLP 的 shape 和字节不变。
- Decoder 总计为每层小计 ×36；全卡再乘 t，包含 Attention 复制，不能当作去重参数总量。空闲 rank 仍持有参数。

TP8、MLP FP8，其余 BF16：

| Attention DP | Attention TP | Q 本地 heads | K/V 本地 heads | Decoder / rank |
| --- | --- | --- | --- | ---: |
| 1 | 8 | 4 | 1 | 1,057,738,752 B |
| 2 | 4 | 8 | 2 | 1,435,226,112 B |
| 4 | 2 | 16 | 4 | 2,190,200,832 B |
| 8 | 1 | 32 | 8 | 3,700,150,272 B |

不含 Embedding、LM Head、KV、激活、后处理额外分配、通信、allocator 或转换峰值。统一 4/8/16/32-bit 仍只是无 scale 的理论对照，与自定义混合总账分开。

## KV：总量不变，归属可以改变

本模型有 8 个 KV heads；a≤8 且整除 8 时按 heads 分片，不需要复制 head。当前 rank 的单层逻辑 K+V 为 `[B_group,S,2,8/a,128]`，字节 = 该 shape 元素数 ×36 层 ×cacheBytes。全卡合计为全部不同请求数 ×S×36×2×8×128×cacheBytes，与 d 无关。不要用 GLM MLA 的“组内完整 latent 复制”公式，也不要在已经分片的 cache shape 上再除 a。

例：TP8/DP4、请求组 `[3,1,0,2]`、S=128、每元素 2 B。每组有两个 Attention TP rank，各持四个 KV heads；每卡逻辑缓存依次为 `[27,27,9,9,0,0,18,18] MiB`，全卡 108 MiB。普通 TP8 处理同样 6 个请求时每卡 13.5 MiB，全卡仍为 108 MiB。因此“全卡不变”不代表每卡不变，也不意味着负载均衡。

这里没有分页/前缀共享与驻留/scale/容量预分配；空闲组 0 仅表示例中没有请求及旧缓存，不表示真实服务器必然释放所有 KV。通信 padding 不写入历史缓存。

## 输入输出与通信缓冲

同一请求组的 Attention TP peers 协作相同有效 token，但持有不同 Q/K/V heads；不同 DPA 组处理不同请求。Attention 有效输入/返回输出 `[N_group,4096]`；MLP 输入、归约后逻辑输出 `[N_buffer,4096]`，后者包含 padding。

上例 Decode 对齐为 `[4,2,0,2]`，MAX_LEN 给每组 4 行，MLP buffer 为 16 行。Rank5 属于空闲组，有效 QKV 为 `[0,3072]`，仍可参与 `[16,3072]` 的合并 Gate/Up 计算。完整 Prefill 使用 SUM_LEN，共 768 个有效/缓冲行。所有组都空闲时为零行，不假装仍有必须执行的有效计算。

Q/K/V 拆分是融合 QKV 容器的视图，不能重复相加；Norm/RoPE 可产生后续张量。内部载荷按 BF16 逻辑情景对照，不冒充量化 kernel 的实际临时缓冲，更不把所有阶段相加当作峰值显存。

## 验证入口

`dpa-lab.test.mjs` 独立验证所有 TP/DPA、均匀与非均匀请求、空闲、Prefill/Decode、两种 cache 位宽、MLP 混合精度与统一位宽，检查 heads 区间完整覆盖、逐 rank cache 和全卡守恒、权重独立算式及输入输出字节。URL 以该模型的 36 层、40,960 上下文边界校验，非法 EP/专家选项被清理或拒绝。

`dpa-lab-render.mjs` 加入 40 组 Qwen DPA 页面检查；`model-browser.mjs` 检查真实路由、拖动、精确字节、请求归属、模型切换、TP 收缩/恢复后的首次 DPA 操作与 URL 重载。既有 GLM DPA 测试保留，防止抽取模型参数时改变原行为。
