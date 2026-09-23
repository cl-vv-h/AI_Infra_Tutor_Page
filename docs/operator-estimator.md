# 算子耗时估算 / v1.0

入口：主页“算子耗时估算”及 `#/operators`。纯客户端，无 API、无模型密钥，不上传或持久化输入与实测值。主动导出 JSON 只含估算参数和结果，不含实测时间及任何 profile 文件。

## 范围

- 单执行域、HBM 驻留情景；用户输入本地 shape，不自动进行 TP/EP 分片。
- Ascend 910C 单 die；950PR 的 32/28 Cube SKU；950DT 的 36 Cube SKU；可编辑自定义配置。
- MatMul / batched MatMul（可广播 B）、Lightning Indexer（打分与 Top-K）、RMSNorm、Softmax、按行 Gather。
- BF16/FP16；MatMul 另支持目标配置中的 FP8、INT8、MXFP4。910C 不把 FP8 当作原生支持。
- 输出：计算量、流量、输入输出/中间张量容量、资源下界、耗时情景区间、主导项、实测对照与排查建议。

## 规格证据（2026-09-23 核查）

[950 官方架构白皮书](https://public-download.obs.cn-east-2.myhuaweicloud.com/ascend/昇腾950%20NPU架构白皮书.pdf) 表 3-1（PDF 第 13–14 页）：矩阵峰值使用 **Cube** 行，不用 Cube+Vector 总算力。950PR 32/28 Cube 的 BF16 为 432/378 TFLOP/s，带宽 1.6/1.4 TB/s；950DT 36 Cube 为 486 TFLOP/s、4 TB/s。Vector 使用 FP32 行。不同频率/功耗/SKU 必须现场核对。不是采购或交付状态声明。

[CloudMatrix384 论文](https://arxiv.org/html/2506.12708v2#S3.SS3.SSS1) 确认 910C 双 die 与单 die 64 GB、1.6 TB/s。**910C 默认 375 BF16 TFLOP/s、750 INT8 TOP/s 和 Vector 10 TFLOP/s 是未核验的情景假设，不是论文声明的硬件峰值**，界面始终提示并允许修改。自定义设备同样是演示假设。

[CANN Lightning Indexer 接口](https://github.com/hicann/ops-transformer/blob/master/attention/lightning_indexer/docs/aclnnLightningIndexer.md) 支持加权 ReLU 多头打分和 Top-K。这里建模逻辑 BSND，不承诺覆盖该接口所有 layout、稀疏模式与版本限制。超出 head dimension/head count/top-k 的部分限制时提示。未验证实际设备可执行性。

## 分析方法

`Tcenter = max(Tcube, Tvector + Tselection, Thbm) + Tfixed`，Cube/Vector 各自按独立峰值与有效效率折算；Top-K 代理成本 `P log2(max(2,K))` 除以用户提供的有效选择吞吐，**不**除以 Cube 峰值。默认效率与吞吐没有实测校准。Indexer 的 Top-K 与 score Vector 阶段共用资源，不假设二者完全重叠。

资源下界：`max(Fcube/Pcube, Fvector/Pvector, Dmin/BWhbm)`；未包含选择、特殊指令延迟或设备开销。它仅在输入来自 HBM、所声明逻辑工作量成立时适用，不是缓存驻留情景的物理下界。

区间下端在中心有效效率上提升 25%（≤100%）并重叠资源；上端效率取中心的 60% 并串行求和。这个敏感性区间 **不是置信区间、不是拟合精度保证、更不是严格执行时间上下界**。随同设备同 shape 的独立微基准修改效率、流量放大和设备固定开销后再对照待排查样本。

MatMul：2BMNK，输入输出最小流量；16-bit 输出。量化 scale 为明确的存储假设；没有声称模拟全部量化格式或反量化 epilogue。Indexer：全部有效 pair 打分，Top-K 不缩小打分范围；可选择完整聚合 scores 落 HBM（一次写一次读）。causal 为右对齐并跳过无效 pair 的算法情景。实际 tile 仍计算 mask 区域时必须校准。RMSNorm/Softmax 基础 Vector ops 不是 exp/rsqrt 的等价时钟计数。Gather 默认无缓存命中、按选中行传输、INT32 索引，可重复索引。

不模拟 kernel tiling、L2/UB/L1、离散事务、动态核数、分页查表、通信、Host 队列、编译与多流竞争。内存容量只核对所列逻辑张量，未含其他模型数据及未知 workspace；超过容量时禁止输出“正常/异常”的性能判定。

## Profiling 口径

使用预热后的设备侧同 shape 耗时中位数。Indexer 对照覆盖打分和 Top-K，不能只取其中一个 kernel。多流存在重叠时区分 kernel duration、kernel 总工作时间与端到端 makespan。Host API duration 不是 NPU task duration。

需要管线信息时使用 Level1 + PipeUtilization 并验证产物；不要硬编码 CSV 列数作为所有 CANN 版本的真理。内存指标可另采 Memory/L2Cache。超出情景范围只产生排查线索，不自动判定 bug。字段核对见 [CANN Profiling](https://www.hiascend.com/doc_center/source/zh/CANNCommunityEdition/910beta2/devaids/Profiling/atlasprofiling_16_0067.html)。

## 验证

`npm run test:operators`：独立算术、单位、广播、量化 scale、Indexer causal/Top-K/物化、归约与 Gather、容量、参数溢出、实测判定。

`npm run test:operators:browser`：真实浏览器操作各硬件/算子/精度，校准、错误输入、实测 µs/ms、JSON 导出隐私与移动端溢出。可设置 `MODEL_QA_BASE` 指向生产预览或线上站点。

没有 NPU 实测，因此验证证明页面与分析公式正确工作，不证明真实 kernel 时延预测精度。
