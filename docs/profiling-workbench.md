# Profiling 分析工作台

入口 `#/operators`；原理论计算器移至 `#/operators/estimate`。主页与导航指向采样分析。热点可经用户确认后带入理论校核，返回工作台保留当前内存分析。

## 实际工作流

1. 预热后导出设备逐任务数据，按同一阶段/负载采样。导入基线 A；按设备、Stream、Step 或相对时间窗口选择稳态。不会凭名称猜测 prefill/decode，也不会自动丢弃第一条调用。
2. 按累计工作量、独占覆盖或长尾倍率定位热点。聚合签名为 `Type + Input Shapes + Input Data Types + Input Formats`；展示调用次数、均值、P50/P95、min/max 与累计占比。分位数采用线性插值，描述样本内调用分布，不是实验间置信区间。
3. 检查高频短任务、长尾和通信相关提示。提示是下一步取证方向，不是自动根因诊断；字段不完整时明确提醒分组可能混合不同负载。
4. 导入候选 B，确认硬件、软件、精度、阶段、负载与计时口径可比较。独立筛选 A/B；比较调用次数变化、P50 比率、原始累计差，以及 `(B mean − A mean) × A count`。完整签名才能做按调用量归一化的比较；新增/消失/签名不全分别列出。还需手动核对转置、属性和融合语义。没有统计显著性声明。
5. 优化情景只计算指定组加速对**累计工作量**的影响，不把它当成端到端加速。需要进一步估算的标准 MatMul/RMSNorm/Softmax 可带入理论页，必须确认布局、算子范围和硬件。未知/融合/量化签名不自动映射。

## 导入与兼容性

- CSV：`kernel_details.csv`、设备逐调用 `op_summary` 风格表；Name/OP Name 或 Type/OP Type，以及 Duration(us)/Task Duration(us) 必需。支持时间列 us/µs/μs/ms/ns/s 单位；无单位列默认拒绝，可明确指定 us/ms/ns。不把 aicore_time 或 Wait Time 当作 task duration。
- CSV 可选 Device ID、Stream ID、Step ID、Start Time(us)/Task Start Time(us)、Input Shapes/Data Types/Formats。支持 BOM、CRLF、引号内逗号/换行、双引号转义。重复表头、截断引号、聚合 Count 非 1 拒绝；畸形行/无效 duration 计数并跳过。缺失起始时间保留调用统计，但不报告完整时间线指标。
- JSON：Chrome Trace 数组或 `{traceEvents: [...]}`。有 Ascend Hardware/GPU/Device 数字进程标记时只取设备 PID 的完整 `ph:X` 事件；缺少标记时只取 kernel/gpu_kernel/gpu_memcpy/gpu_memset 类别，不把任意 Host X 事件混入。B/E 不配对，明确提示。Chrome 的 ts/dur 为 µs，displayTimeUnit 不改变含义。
- 不支持 DB、压缩包、聚合 op_statistic 或仅有 Host 的 trace。50 MiB / 文件、200000 设备任务、20000 分组，超限明确拒绝，不静默抽样。Trace 原始事件最多 1000000。异常大字段拒绝。导入选择的文件名不作为分析字段保存。

## 时间线口径

同一设备域中按区间端点 sweep，计算任务区间并集、两条以上任务活跃的覆盖时间，以及计算与通信区间交集。相邻区间不算重叠；嵌套/重复区间保留调用工作量，但不会重复累计并集。

- `total`：所有所选任务 duration 之和，可以大于窗口跨度。
- `span`：最早所选任务开始至最后结束，不是应用端到端耗时。
- `busy`：所选任务覆盖并集；`idle = span − busy` 在界面称“未覆盖”，不直接称真实设备空闲。
- `exclusive`：同一签名独占活跃的区间，没有其他**已选**签名任务；不证明关键路径。窄筛选会增大这一指标。
- 通信分类依 Task Type/OP 名称启发式，包含通信同步/notify。通信与计算交集不证明有效 overlap，更不能据此识别完整依赖图或根因。

默认只分析一个设备/PID；不混合跨设备未校时的时间线。时间过滤相对于各自执行域的最早任务，仅保留完整落入窗口的调用，不裁切 task duration。预览只画最早 1200 个调用、前 12 个 Stream；所有数值统计仍使用全部筛选任务。超过预览范围时明确标注。

## 隐私与生命周期

每个采样一个 Web Worker；文件读取、解析、筛选均在浏览器内，解析和排序不会在主线程执行。输入没有网络上传、localStorage、sessionStorage 或 URL 持久化。替换文件/清空会终止对应 Worker；离开整个性能板块会销毁两者。仅在工作台与理论校核间切换时保留内存数据；刷新后消失。

热点向理论页的传递使用内存模块，不使用浏览器 history.state。导出 JSON 使用字段白名单，只有统计数值和匿名编号，不含文件名、设备/PID、算子名称、shape、dtype 或绝对时间戳。数值本身也可能敏感，不能声称这种导出可无条件公开。A/B 没有确认可比性时不导出比较结果。

合成示例由代码生成，用于演示 MatMul 提速、Indexer 回归和短任务调用减少，未使用任何真实用户数据。

## 证据与边界

字段核对：[CANN op_summary 指标说明](https://www.hiascend.com/doc_center/source/zh/CANNCommunityEdition/910beta2/devaids/Profiling/atlasprofiling_16_0067.html)。原始 Task Duration 可能包含任务调度/响应，不是纯 Cube 周期。

设备/Host 分层与标准工具参考：[MindStudio Insight System Tuning](https://www.hiascend.com/document/detail/en/mindstudio/2610/visualization_tool/MindStudioInsight/docs/en/user_guide/system_tuning.md)。需要流水线证据时使用 Level1 + PipeUtilization，并按版本验证采集字段；内存问题可另采 Memory/L2Cache。本版不凭利用率阈值做自动 roofline 归因。

本版已验证格式适配与分析数学，但尚未收到用户真实 trace；未宣称兼容所有 CANN 版本或替代 MindStudio。真实数据遇到不同列名或事件布局时，应显式报错或降级，不能编造缺失指标。

## 验证

`npm run test:profiling`：CSV/JSON、单位、畸形输入、设备隔离、时间窗口、随机区间独立 oracle、分位数、A/B 调用量归一化、匿名导出、理论桥接、50000 任务统计与预览限量。

`npm run test:profiling:browser`：四种屏幕尺寸、真实 Worker 导入、合成示例、筛选错误恢复、A/B 确认、热点校核并返回保留、匿名下载、恶意输入无脚本执行/外发、清空与刷新无持久化。
