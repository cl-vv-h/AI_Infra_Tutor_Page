# Qwen3-30B-A3B：EP 与模块精度

核对日期：2026-09-16。样本为原始 Qwen3-30B-A3B，不替换为后续 2507 版本。支持普通 TP、组内 EP 与独立 DP 副本；没有在此模型上启用 DPA。

## 来源与边界

- [官方配置](https://huggingface.co/Qwen/Qwen3-30B-A3B/blob/main/config.json)：48 层，每层 128 个专家，Top-8，中间维 768，hidden 2048；32 个 Query heads、4 个 KV heads、head dim 128。无 Dense-only 层和共享专家，官方 dtype 为 BF16。
- [固定 SGLang Qwen3 MoE](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/models/qwen3_moe.py)：SparseMoeBlock 读取 moe_tp_size/ep_size，使用 ReplicatedLinear gate；普通量化路径的 Router 保持 BF16，而非固定 FP32。TopK 选择后重新归一化。forward_normal 在需要时分别执行 EP 与 MoE-TP 归约；不把普通 EP 解释为已运行 DeepEP All-to-All。
- [FusedMoE](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/moe/fused_moe_triton/layer.py)：专家数按 EP 划分，中间维按 MoE-TP 划分，Gate/Up 合并。当前无冗余专家、EPLB、共享融合、DPA、PP、特殊 runner padding；A2A=none。某些 FlashInfer runner 会补齐中间维，不属于本页无 padding 情景。
- FP8/MXFP4/W4A8 是自定义模块存储情景，沿用 [FP8](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/quantization/fp8.py) 的 block 布局和 [W4AFp8](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/quantization/w4afp8.py) 的已核对权重/scale 阶段，不是原生 checkpoint 清单、转换器或可部署硬件支持声明。未运行 GPU 推理。

## 逐 rank 几何

令 t=TP、e=EP、m=t/e，E=128/e、I=768/m。Gate/Up 为 `[E,2I,2048]`，Down 为 `[E,2048,I]`；Router `[128,2048]` 复制，不除 TP 或 EP。全体本地专家常驻，不只加载 Top-8。增加 EP 把中间维分片换成更少的完整专家，不再次除每卡权重。

TP8/EP1 时 E=128、I=96；TP8/EP8 时 E=16、I=768。后者 Rank7/15 的 EP rank 为 7，专家为 112–127；Rank15 属于第二个独立副本。专家激活仍用未知的 T_e 表示，不假设均匀分摊。

Attention 使用完整 TP；TP8 的每个 KV head 复制到两个 rank，K/V 每份 `[128,2048]`，不是半个 head。EP 不改变 Attention、KV 或模块边界 `[N,2048]`。独立 DP 增加整个 TP 组和不同请求，不减小每 rank 的 B。

## 格式约束与总量

FP8 block 128×128 要求 Gate/Up 的每一半及 Down 的输入轴都按 128 对齐；W4A8 group 128 要求各输入分片按 128 对齐。I=768 或 384 满足，I=192 或 96 不满足。因此当前无 padding 情景只在 MoE-TP=1/2 开放 FP8/W4A8；MoE-TP=4/8 保留 BF16/MXFP4，后者的 32 对齐仍满足。

控件随 TP/EP 重建合法选项范围。旧链接或缩小 EP 导致格式失效时，明确提示并恢复 routed BF16，不生成 fractional scale、不崩溃，也不暗中增大 EP。恢复合法布局后须重新选择格式。模型没有 Dense 或 Shared MLP，隐藏并清理这些无效精度。

混合面板按用户指定习惯将 Router 固定 FP32，这是与原生 BF16 区分的自定义方案。两套层 RMSNorm 加 Q/K Norm 共 8,704 B/rank/layer；Attention 为 `33,554,432/t + 1,048,576×max(4/t,1)` B。Router 原 BF16 为 524,288 B，自定义 FP32 为 1,048,576 B。

每 rank、每层 routed 专家：

| 格式 | 权重与 scale 字节 |
| --- | ---: |
| BF16 | 1,207,959,552 / t |
| FP8 block | 604,127,232 / t |
| MXFP4 | 320,864,256 / t |
| W4A8 初始 | 320,864,256 / t + 768 / e |
| W4A8 后处理 | 311,427,072 / t + 8 |

W4 初始多出的 768/e 来自两个 Gate/Up input scales 和一个 Down input scale，每专家各 2 B。后处理 weight scale 转 BF16，Gate/Up 和 Down 各缩成一个 FP32 input scale，共 8 B；不重复计算被替换的初始 scale。方法运行元数据另列，没有加进权重小计。

48 层总账逐项乘层数，不含 Embedding/LM Head、KV、激活、通信、额外后处理缓冲或分配峰值。统一 BF16 下 TP1 图示 Decoder 为 59,819,581,440 B；TP8 为 7,524,999,168 B/rank。TP8/EP8、Router FP32、routed W4A8 后处理情景：单层 MoE 39,976,968 B/rank，全部 Decoder 2,170,970,496 B/rank。独立 DP 副本只复制这些数值。

## 验证

`mixed-precision.test.mjs` 使用独立常数算式核对全部 TP/EP、可选格式、两阶段及 48 层总量；检查无效格式拒绝与 URL 恢复、128 个专家的完整归属、复制 Router 和 TP8 KV heads。`w4-lifecycle-render.mjs` 增加 80 个模型/拓扑/格式/阶段组合，包括明确回退提示和无效模块隐藏。真实浏览器覆盖 EP8→EP1→EP8、格式范围恢复后的首次 End、W4 初始/后处理、第二副本 Rank15 及刷新。
