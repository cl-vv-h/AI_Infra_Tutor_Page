# Qwen3-8B：Dense 混合精度与 SGLang 融合布局

核对日期：2026-09-16。范围是 Qwen3-8B 的 36 层 Decoder、TP=1/2/4/8、独立 DP 副本、PP=1、无 DPA；不是 Qwen3 MoE，也不是完整 checkpoint 或 GPU 显存清单。

## 来源与边界

- [Qwen 官方配置](https://huggingface.co/Qwen/Qwen3-8B/blob/main/config.json)：H=4096，I=12288，36 层，32 个 Q heads、8 个 KV heads，head_dim=128，无 attention bias，BF16，Embedding 与 LM Head 不共享。
- [固定 SGLang Qwen3](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/models/qwen3.py)：复用 Qwen2MLP；Q/K Norm 各有 [128] 参数；每层同时有 input_layernorm 和 post_attention_layernorm。默认 Norm dtype 与模型一致；确定性 RL 等特殊 FP32 分支不在本情景内。
- [同版本 Qwen2MLP](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/models/qwen2.py)：MergedColumnParallelLinear(H,[I,I])、SiluAndMul、RowParallelLinear(I,H)，MLP 两个 Linear 均无 bias。
- [同版本 Fp8Config / Fp8LinearMethod](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/quantization/fp8.py)：block quant 要求 FP8-serialized checkpoint 和 dynamic activation。初始权重使用 E4M3，scale 为 ceil(O/128)×ceil(K/128) 的 FP32；dynamic 模式不创建静态 input_scale。ignored_layers 支持保留其他 Linear 为非量化形式。

页面是自定义存储情景，MLP 可选 BF16/FP8，Attention 和 Norm 保持 BF16。并未转换权重、准备 FP8 checkpoint 或验证设备上的模型启动；不能把此选择理解成给原 BF16 模型加一个启动选项即可实现。其他后端后处理、padding、转换峰值、workspace、KV、Embedding、LM Head 均不在 Decoder 小计内。

## 独立算式

设 t=TP，i=12288/t。所有支持的 t 都满足 block 128 对齐，Gate/Up 每一半分别对齐，无需向上补齐。

- 原图 Gate、Up 各 [i,4096]，Down [4096,i]；融合 Gate/Up 为 [2i,4096]。融合前后总元素守恒，不重复加两套权重。
- BF16 MLP = 3×4096×i×2 = 301,989,888/t B。
- FP8 MLP payload = 150,994,944/t B；FP32 block scale = 3×(4096/128)×(i/128)×4 = 36,864/t B；合计 151,031,808/t B。
- 合并 Gate/Up scale [2i/128,32]，Down scale [32,i/128]；没有静态 input scale。
- Attention 矩阵：Q/O 各 4096²/t，K/V 各 8×128×4096/t，按 BF16 合计 83,886,080/t B。
- 两套完整层 RMSNorm 及 Q/K Norm = (2×4096+2×128)×2 = 16,896 B/rank。Norm 复制，不除 TP。公共 Decoder 逻辑已经补入 post_attention_layernorm，不再在模型定义中重复增加。

| TP | 全 BF16 Decoder / rank | 仅 MLP FP8 的 Decoder / rank |
| --- | ---: | ---: |
| 1 | 13,892,143,104 B | 8,457,652,224 B |
| 2 | 6,946,375,680 B | 4,229,130,240 B |
| 4 | 3,473,491,968 B | 2,114,869,248 B |
| 8 | 1,737,050,112 B | 1,057,738,752 B |

全 TP 组的小计乘 t，独立 DP 全副本再乘副本数；其中包含 Norm 的复制，不能当作去重模型参数。增加副本不缩小本卡矩阵，也不改变本地 batch。

## 页面与验证

纯 Dense 页面仅显示 Dense MLP 精度滑块，不显示 Shared/Routed/W4A8 控件；旧链接中的不适用专家参数会提示并归一化，不修改有效 Dense 精度。融合布局折叠显示；逐 rank 内部张量随 TP、batch 和阶段变化：合并投影 [N,2i]、激活 [N,i]、Down 部分和 [N,4096]。模块输入/输出仍采用 BF16 逻辑边界，不声称它们是 FP8 kernel 内部缓冲。

`mixed-precision.test.mjs` 使用上述独立算式检查所有 TP、两种 MLP 精度、四种副本数和 Prefill/Decode，验证 36 层总账、两套 Norm、融合前后守恒及 URL 清理。`w4-lifecycle-render.mjs` 增加 8 个纯 Dense 路由；`model-browser.mjs` 覆盖真实精度/TP 拖动、融合 shape/scale/精确字节、内部张量、URL 重载和四种屏宽。测试不包含 GPU 推理。
