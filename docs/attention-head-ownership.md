# 普通 TP 的 Q/K/V head 归属

核对日期：2026-09-16。当前仅对 Llama-3.1-8B、Qwen3-8B、Qwen3-30B-A3B 开放。不是按相似维度自动推断所有 GQA 模型；OLMo 的全量 QKV 汇集、MLA、混合递归状态、DPA、CP 与特殊 KV TP 仍使用各自独立说明。

## 固定来源

- [SGLang QKVParallelLinear](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/linear.py#L952) 的构造器按 TP 切 Q heads；KV head 数小于 TP 时定义 `num_kv_head_replicas`。同文件 [weight_loader](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/linear.py#L1369) 对 Q 使用 tp_rank，对 K/V 使用 kv_tp_rank 整除复制倍数取得 shard ID。
- [LlamaAttention](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/models/llama.py)、[Qwen3Attention](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/models/qwen3.py) 和 [Qwen3MoeAttention](https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/models/qwen3_moe.py) 都通过这个投影类构造 QKV，O 采用 RowParallelLinear。此处无 DPA，Attention TP 等于普通 TP。

## 映射

令总 Q/KV head 数为 Q/K，TP=t，当前 TP local rank=r，head_dim=d：

- 每卡 Q heads 为 Q/t；Q head 起点 r×Q/t。
- 每卡 KV heads 为 max(1,K/t)，复制倍数 c=max(1,t/K)。KV head 起点 floor(r/c)×max(1,K/t)。
- Q 投影逻辑行与 O 投影逻辑列区间为 `[Q_start×d,Q_end×d)`；各 K/V 投影逻辑行为 `[KV_start×d,KV_end×d)`。这不是融合 QKV 参数的物理偏移或 packed 权重字节索引。
- 同 KV 分片的 peers 是当前独立副本内、从 floor(r/c)×c 开始的 c 个 TP ranks。独立 DP 副本只平移教学 rank 编号，不更改投影切片。

例如 Qwen3-30B-A3B 的 Q=32、K=4、d=128，TP8：

| 当前副本的 TP local ranks | Q heads | K/V head |
| --- | --- | --- |
| 0 / 1 | 0–3 / 4–7 | 0 |
| 2 / 3 | 8–11 / 12–15 | 1 |
| 4 / 5 | 16–19 / 20–23 | 2 |
| 6 / 7 | 24–27 / 28–31 | 3 |

第二个副本的 Rank15 为 TP local7，持有 Q28–31、K/V3；Q 行与 O 列为 `[3584,4096)`，K/V 行为 `[384,512)`，同 KV peers 为 R14/R15。它不把第一副本 R6/R7 列作同请求的复制 peers。不同副本的权重可以相同，实际激活与 KV 值因请求不同通常不同。

EP 改变专家布局，不改变以上 Attention head 归属。Q heads 的值分片不同，即使每卡 Shape 相同；O 本地部分和需要归约，不能从最终模块输出宽度推断每张卡持有完整 O 权重。

## 展示与验证

普通 rank 面板选择 GQA 模块时显示当前 head 范围摘要；展开后只列当前独立副本的 TP ranks，突出当前 rank，标明零起始 ID 与右端不包含的矩阵区间。不引入新 URL 参数，也不改原有权重、缓存、混合精度和 DPA 数值。

单元测试覆盖三模型所有 TP/独立 DP 的 Q 完整无重叠分区、KV 精确复制倍数、Q→KV 分组关系、投影矩阵元素对账、peer 不跨副本、EP 不影响归属及非法拓扑拒绝。静态渲染检查默认折叠和每副本表格行数；浏览器检查 Rank15→14、切换副本、EP 改变、TP 收缩和 URL 重载。未运行 GPU 推理或验证通信性能。
