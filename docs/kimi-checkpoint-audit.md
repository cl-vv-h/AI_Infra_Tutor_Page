# Kimi K3 原生 checkpoint 字节审计

审计时间：2026-09-16 北京时间（生成记录使用 UTC）。这份审计解释官方约 1.56 TB 的文件体积，不代表 GPU/NPU 加载后常驻量或峰值显存。

## 已获取的证据

- [Moonshot 官方 ModelScope 目录](https://modelscope.cn/models/moonshotai/Kimi-K3)列出 96 个 safetensors 分片。文件名总数部分为六位 `000096`。
- [Hugging Face 官方索引 LFS 指针](https://huggingface.co/moonshotai/Kimi-K3/raw/main/model.safetensors.index.json)声明索引 JSON 大小为 59,764,096 B，SHA-256 为 `a1c5210650ce71d2d3ae9ec5a101ac4afd3cf4b10091be589853437eb967febd`。从 ModelScope 获得的索引已逐字节计算 SHA-256 并匹配，不把索引自身大小当作模型大小。
- 从 ModelScope 的逐文件固定 commit 读取全部分片的 8 B 长度前缀和 JSON header。只有精确 HTTP 206 / Content-Range / 长度响应才允许读取；若服务忽略 Range 返回 200，立即取消 body，不下载完整分片。
- 497,220 个张量逐项匹配 index 的 weight_map；校验 dtype × shape、data_offsets、连续载荷、重复/缺失条目及文件末尾。全部载荷与 index.metadata.total_size 精确一致。

生成器是 `scripts/kimi-checkpoint-audit.mjs`。输出 `src/data/kimi-checkpoint-audit.json` 只保留白名单字段：文件名、大小、发布方 SHA-256、固定版本、文件头 SHA-256、张量数量、模块/dtype 聚合、216 组 shape 模板和 93 层小计。不保留提交者、作者、提交信息、临时签名 URL、本地路径或认证资料。

重现命令（联网，只下载元数据）：

```sh
node scripts/kimi-checkpoint-audit.mjs src/data/kimi-checkpoint-audit.json
npm run test:models:checkpoint
```

此过程读取 135,530,680 B 元数据。每份 header 限制 16 MB，全部元数据限制 256 MB，并行度为 4。索引/分片由各自固定版本解析；ModelScope 的两份分片版本与索引版本均保存在生成清单。索引身份被 HF 指针固定，未来不匹配时失败，不自动接受新权重版本。

## 精确对账

| 步骤 | 字节 |
| --- | ---: |
| 图示 Decoder，全部逻辑元素假定 4-bit | 1,388,567,822,128 |
| 加 routed experts 的 MXFP4 UINT8 / group-32 scales | 85,085,650,944 |
| 图示非专家元素从 4-bit 恢复到 BF16 | 81,592,221,072 |
| 对照方案小计（并非原生 dtype） | 1,555,245,694,144 |
| 原生 F32 相对 BF16 增量 | 22,244,864 |
| A_log 的 checkpoint 128 vs runtime 96 个元素差额，按 BF16 基线补足 | 4,416 |
| 原生 Decoder 载荷 | 1,555,267,943,424 |
| Embedding、LM Head、视觉与输出 Norm / AttnRes | 5,592,381,440 |
| 全部张量载荷 / index total_size | 1,560,860,324,864 |
| safetensors header 与 8 B 前缀，共 96 份 | 75,766,584 |
| 全部权重文件 | **1,560,936,091,448** |

完整文件为 1.560936091448 TB / 1.419663104978099 TiB。网站三位小数显示 1.561 TB，官方两位小数显示约 1.56 TB，两者一致。上表文件总量不含单独的索引、tokenizer、配置或代码文件。

原生非 Decoder 载荷独立拆分：Embedding 与未绑定的 LM Head 各 2,348,810,240 B；视觉塔 802,428,928 B；投影与 post_norm 92,289,024 B；输出 Norm / AttnRes 43,008 B。

原生专家的 w1/w3 packed 为 U8 `[3072,1792]`，scale 为 U8 `[3072,112]`；w2 分别是 U8 `[3584,1536]`、`[3584,96]`。U8 是两个 MXFP4 数值的存储容器，不是逻辑 8-bit 权重。92×896 个专家全部驻留在未分片 checkpoint，不按 Top-16 激活数量缩减。

Router gate.weight 在 checkpoint 中是 BF16 `[896,7168]`，correction bias 是 F32 `[896]`。KDA 的卷积、A_log、dt_bias、o_norm 也是 F32。自定义混合方案固定 Router FP32，不能冒充 native checkpoint 格式。

[固定 SGLang Kimi loader](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/models/kimi_k3.py)将 A_log 从文件的 `[128]` 取前 96 个，再按 Attention TP 分片到 `[1,1,96/TP,1]`。现有图示记录这个运行时逻辑元素数，不能为了文件对账直接改成 128。先按原生 F32 全形状增加相对 BF16 的差额，再补足基线遗漏的 32×69×2 B，避免重复统计。

## 验证边界

这证明了发布方元数据内部一致、索引文件 SHA-256 和全部张量清单的精确字节关系；**没有下载或哈希校验 1.56 TB 权重载荷**。清单中的分片 SHA-256 是发布方声明，不是本机重新计算；文件头 hash 是本机实际计算。

这也不证明所有 SGLang backend 对该 checkpoint 都能直接部署。原生 dtype 的加载转换、TP/EP/DPA 复制/分片、kernel 后处理、临时 workspace、KV、激活、allocator 与峰值需另外建模和验证。完整文件不能简单除 TP 当作每卡显存。当前统一 4-bit TP1 可复现 1.389 TB / 1.263 TiB，尚未取得用户反馈中 1.14 TB 的精确配置或截图，因此不声称已复现那个旧值。

本次不修改周报自动化、API 配置、Git 凭据或新闻工作区。完整网站目标仍未完成；本地元数据审计不等于上线发布。

## 原生加载初始参数：连接到 TP / EP / 独立 DP

新增 `kimi-native-layout.ts`，直接消费上述完整元数据，而不是把图示 Decoder 小计当全模型。范围固定为 CUDA SM100 / FlashInfer MXFP4、模型默认 BF16、PP=1、A2A=none、无 DPA/EPLB/冗余专家的**后处理前初始参数分配**。其数字不随页面自定义 MLP/专家量化方案改变；它不是最终常驻内存。

逐模板映射全部 216 组 shape：Attention 按 head 对应的输出/输入轴 TP 分片，低秩输入投影与 Norm 复制；Dense/Shared MLP 使用完整 TP；routed experts 的份数除 EP、w1/w3 的 OUT 和 w2 的 IN 轴除 MoE-TP=TP/EP；Embedding/LM Head 的词表轴按 TP 划分，163840 在这些配置下无需词表填充。视觉塔/投影完整复制，视觉内部 MLP 不能误按文本 Dense MLP 分片。Router/latent 投影/残差参数复制。每行是源张量分片，不冒充融合后的 kernel 容器布局。

已核对的加载变化：A_log 从原生 [128] 取前 96 heads，并变为本 rank `[1,1,96/TP,1]`，保持 F32。`FusedRMSNormGated` 没有显式指定 dtype，因此 o_norm 按模型默认 BF16 创建并在加载时转换。Router `MoEGate` 默认保存 BF16 gate.weight，而 CUDA 路由输出 logits 为 FP32；这不是将 gate.weight 改成 FP32。与自定义混合方案固定 FP32 Router 的教学条件保持区分。

MXFP4 `create_weights` 的六个实际容器每层为：

| 参数 | Shape | dtype |
| --- | --- | --- |
| w13_weight | [E, 2I, 3584/2] | U8 |
| w13_weight_scale | [E, 2I, 3584/32] | U8 |
| w2_weight | [E, 3584, I/2] | U8 |
| w2_weight_scale | [E, 3584, I/32] | U8 |
| w13_weight_bias | [E, 2I] | BF16 |
| w2_weight_bias | [E, 3584] | BF16 |

E=896/EP，I=3072/(TP/EP)。SM100 FlashInfer 的 I/H 对齐均为 128，当前 TP/EP 范围无需 padding。前四项与 checkpoint 专家分片字节一致，只计一次；后两项由 CUDA 分配为零，即使原生 checkpoint 没有 bias 也存在。额外 bias 共 `92 × E × (2I + 3584) × 2` B。固定 TP 时专家 payload/scales 不变，但 w2 bias 随 E 变化，因此不能说 EP 对初始参数字节完全无影响。

| 条件 | 映射后的全模型参数 / rank | 额外 bias / rank | 初始参数合计 / rank |
| --- | ---: | ---: | ---: |
| TP1 / EP1 | 1,560,860,298,368 | 1,603,796,992 | 1,562,464,095,360 |
| TP8 / EP1 | 205,951,281,648 | 717,488,128 | 206,668,769,776 |
| TP8 / EP8 | 205,951,281,648 | 200,474,624 | 206,151,756,272 |

TP1 的映射参数与原生载荷仅差 `69×32×4 + 69×128×2 = 26,496 B`（A_log 裁剪及 o_norm 转 BF16）。独立 DP 只乘完整 TP 组，不将每卡权重再除 DP。选择不同 rank 会更新 EP 专家区间与 MoE-TP 源轴区间，源存储范围使用左闭右开索引。

固定版本来源：[Kimi 构造/加载/视觉复制](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/models/kimi_k3.py)、[MXFP4 分配与后处理](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/quantization/mxfp4.py)、[MoEGate](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/models/deepseek_v2.py)、[FusedRMSNormGated](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/kernels/ops/attention/fla/fused_norm_gate.py)。

上面的初始表不包含后处理：FlashInfer 把 bias 转 F32、创建三个逐专家激活参数、重排 packed/scale；模型还会创建 MLA 投影副本、AttnRes 派生权重以及其他后端缓冲区。下节接入了已核对的后处理增量，但不把未覆盖项设为零，也不将初始参数合计称为峰值或最终常驻量。其他后端尤其有不同 padding 或 scale 重排，不能套用 SM100 这份范围。

## 后处理增量：已核对的持久张量

新增 `kimi-native-postload.ts`，固定 SGLang `96d91ef` 与其 `python/pyproject.toml` 锁定的 FlashInfer **0.6.18**，仅适用于上文 CUDA SM100 / FlashInfer MXFP4 基线。界面阶段可选初始参数或后处理已核对小计，URL 白名单为 `native=processed`。不修改独立的自定义 `w4stage`，切换到其他模型不保留不适用的原生阶段。

### 参数替换

- w13 从 `[gate; up]` 重排为 `(up_i, gate_i)` 配对，再按 FlashInfer 行索引置换；w2 也做行置换。packed 容器 shape/字节保持不变。
- weight scale 经过行置换和 block interleave 后，以 `float8_e4m3fn` **view** 保存；仍承载 UE8M0 scale 字节，不是将数值转换到 E4M3。行数均整除 128，scale 列数均整除 4，当前条件不增加对齐填充。
- 两个 bias 替换为 F32，新旧分配不相加；相对初始参数增加 `92 × E × (2I + 3584) × 2` B。
- 新增 `gemm1_alpha`、`gemm1_beta`、`gemm1_clamp_limit`，每项 `[E]` F32，K3 初值分别为 4、1、25。总计 `92 × E × 12` B；这是逐专家参数，不是逐 token 激活。

### 额外持久存储与别名

| 项目 | shape / 份数 | 每 rank 字节 |
| --- | --- | ---: |
| MLA w_kc | [96/TP,128,512] BF16 × 24 | 301,989,888 / TP |
| MLA w_vc | [96/TP,512,128] BF16 × 24 | 301,989,888 / TP |
| AttnRes combined weights | [7168] BF16 与 F32，各 187 份 | 8,042,496 |
| MXFP4 行索引 cache | 3 个 [2I] + 3 个 [3584]，均 I64 | 3 × (2I + 3584) × 8 |
| KDA f_a/b 合并 padding，仅 TP8 | [4,7168] BF16 × 69 | 3,956,736 |
| KDA fused decode 卷积副本，仅 TP8 | [4,1536] F32 × 3 × 69 | 5,087,232 |
| KDA fused decode 零 conv bias，仅 TP8 | [4608] F32 × 69 | 1,271,808 |
| KDA fused decode o_norm 副本，仅 TP8 | [128] F32 × 69 | 35,328 |

MLA 的 `.contiguous()` 产生独立存储，原 kv_b_proj 仍保留。AttnRes 的 187 份来自 93 层各两个 score 投影与最后一个输出投影，每种 dtype 单独缓存。KDA 的 transpose 中间量和加载时列表/旧 tensor 为临时量，未混入持久小计。

FlashInfer 的 `get_w2_permute_indices_with_cache` 在每个 device 上缓存行索引，SGLang 的 device-cache 对同设备 `.to()` 不产生另一份复制，因此两个字典引用同一组 Tensor。六个不同 shape/mode 的索引由 92 层及其专家共享，不乘层数或 E。这里只核算单模型、当前拓扑的 cache 项，不声称覆盖一个进程此前加载其他模型留下的缓存。

MoE `_merge_front_weights` 把原 shared gate/up、Router、latent down 参数改指向 merged buffer 的 views；KDA f_a/b 合并也采用相同机制。只计新增 padding，不重复添加完整 merged buffer。`_bfa_f_b_w` 与 fused A_log 也是已有参数的别名。

### 小计核对

| 条件 | 后处理参数 | 上述额外持久张量 / padding | 已核对持久张量小计 |
| --- | ---: | ---: | ---: |
| TP1 / EP1 | 1,564,068,881,536 | 612,255,744 | 1,564,681,137,280 |
| TP8 / EP1 | 207,387,247,088 | 93,995,520 | 207,481,242,608 |
| TP8 / EP8 | 206,352,354,544 | 94,124,544 | 206,446,479,088 |

独立 DP 仍按完整 TP 组复制，各 rank 的 shape 相同、内容不同。改变 EP 时，专家 E、I 和索引 cache 的尺寸都会变化；改变 TP8→TP4 时，KDA 专用预备张量与四行 padding 不再适用。

新增来源：[固定 FlashInfer 行索引及 cache](https://github.com/flashinfer-ai/flashinfer/blob/v0.6.18/flashinfer/fused_moe/core.py)、[固定行置换函数](https://github.com/flashinfer-ai/flashinfer/blob/v0.6.18/flashinfer/utils.py)、[SGLang AttnRes dtype cache](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/attn_residual.py)。

**这些数字仍不是完整部署显存**：未涵盖 dispatcher、后端全局 workspace、KV/激活、CUDA Graph、allocator、加载临时副本或转换峰值。没有执行 GPU 推理，也没有将未覆盖项当作零。下一步应核验这些边界及更多 DPA/混合格式，不能用本表宣布网站整体目标完成。
