# 逐权重精度与存储账本

2026-09-23。现有混合精度模型：GLM-5.2、GLM-5.3-Flash、Kimi-K3、DeepSeek-V4-Flash、Qwen3-8B、Qwen3-30B-A3B；同步覆盖 GLM-5.2 与 Qwen3-8B 的 DPA 实验。

## 配置层级

当前层的具体权重覆盖 → 全部适用层的同名权重覆盖 → Dense / Shared / Routed 模块默认 → 未覆盖参数的默认假设。

在权重工作区启用“按模块混合精度”，设置模块默认；展开“逐权重精度”后选择应用范围、模块和具体矩阵。可直接应用 Dense FP8 / Experts BF16 预设。Norm、Router、correction bias、Attention 和其他已列出的 Decoder 权重也可分别覆盖。删除一项恢复继承，清除全部覆盖保留模块默认。

Gate/Up、K/V、Q/K Norm 以及原来以 multiplicity 合计的投影按已核对名称拆开。一个专家投影配置作用于该层该投影的所有本地专家，不提供逐专家编号的不同格式。视觉塔、Embedding、LM Head、V4.1 原生参考路径与未接入混合精度的模型不在此自定义 Decoder 账本范围内。

## 格式与计数

| 选择 | Payload | Weight scale |
| --- | --- | --- |
| BF16 / FP16 / FP32 | 2 / 2 / 4 B 每元素 | 无 |
| FP8 E4M3 block | 1 B 每元素 | 每 128×128 block 一个 FP32 |
| FP8 E4M3 per-tensor | 1 B 每元素 | 每逻辑矩阵一个 FP32 |
| INT8 对称 per-channel | 1 B 每元素 | 每输出通道一个 FP32，无 zero-point |
| INT4 对称 group 128 | 两值一字节 | 每行每 128 个输入元素一个 FP32，无 zero-point |
| MXFP4 E2M1 | 两值一字节 | 每行每 32 个输入元素一个 E8M0，UINT8 容器 |
| NVFP4 E2M1 | 两值一字节 | 每行每 16 个输入元素一个 E4M3，另含每逻辑矩阵一个 FP32 global scale |
| W4A8 专家默认 | INT4 / FP8 路径 | 保留已有固定 SGLang W4AFp8 分配与后处理规则 |

NVFP4 与 per-tensor FP8 以 Gate、Up 及每个专家各自的逻辑矩阵计 scale，不假定融合后共享 scale。不同精度矩阵不能被展示为一个实际可执行的融合容器：详情逐项显示存储，账本只累加拆分项，不再加入旧容器。

格式定义参照 [NVIDIA FP4 说明](https://developer.nvidia.com/blog/introducing-nvfp4-for-efficient-and-accurate-low-precision-inference/)；INT8/INT4 使用明确的对称存储假设，参照 [量化方案与粒度](https://huggingface.co/docs/transformers/quantization/concept_guide)，不冒称为 LLM.int8()、AWQ 或 GPTQ 实现。

低位宽只用于二维投影或具有已核对专家轴的三维权重；向量、bias、Norm 与其他非矩阵参数仅提供 BF16/FP16/FP32。分片后不满足所选 block/group 对齐的项不可选，链接中的无效覆盖会报告并清除，不通过向上取整伪造后端支持。

专家有逐权重覆盖时取消融合 W4A8 后处理阶段与运行元数据展示，沿用明确的拆分初始存储计算；非专家覆盖不影响已有 W4A8 阶段。Router 默认 FP32 只是自定义假设，覆盖后按实际选择统计。

## 一致性与分享

逐 rank、本层、全部 Decoder、所有独立 DP 副本使用同一解析器和层号。DPA 的 Attention 使用 Attention TP，其余投影使用各自已有分片规则。局部覆盖只改变对应层；全层汇总逐层计算，不把当前层大小直接乘层数。

分享链接保留旧的 `mlp/shared/experts` 模块默认，新 `pm` 绑定模型，`pw` 保存有序的权重键/格式对。最多 256 项、24,000 字符；仅接受当前模型已存在且满足对齐的权重，拒绝未知键和格式。换模型清除不属于该模型的覆盖，改变 TP/EP/DPA 后重新验证。配置中仅有公开模型权重名称、层号与格式，不保存个人资料或使用模型 API。

格式选择不推断激活、KV、通信 dtype，也不宣称真实速度、精度或完整部署峰值。计算包含 payload、weight scale、global scale 和已定义的静态 input scale，不包含动态激活 scale、后端工作区或转换峰值。

## 回归入口

- `npm run test:models:precision`：独立格式算式、拆分守恒、层覆盖优先级、链接校验、DPA 对账和模型渲染。
- `npm run test:models:precision:browser`：模块预设、连续逐权重修改、单层覆盖、刷新恢复、全部新增格式与 DPA K/V 分拆，覆盖四种视口。
- 保留原模型、混合精度、W4 后处理、专家打包、原生 checkpoint 与全站模型浏览器回归。
