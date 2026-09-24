# Profiling 分析工作台

入口 `#/operators`；原理论计算器移至 `#/operators/estimate`。主页与导航指向采样分析。热点可经用户确认后带入理论校核，返回工作台保留当前内存分析。

## 实际工作流

1. 预热后导出设备逐任务数据，按同一阶段/负载采样。仅导入基线 A 即可使用默认的“单份阶段与利用率”视图；B 是可选的独立对照。按设备、Stream、Step 或相对时间窗口选择稳态。不会凭 kernel 名称猜测 prefill/decode，也不会自动丢弃第一条调用。
2. 按累计工作量、独占覆盖或长尾倍率定位热点。聚合签名为 `Type + Input Shapes + Input Data Types + Input Formats`；展示调用次数、均值、P50/P95、min/max 与累计占比。分位数采用线性插值，描述样本内调用分布，不是实验间置信区间。
3. 检查高频短任务、长尾和通信相关提示。提示是下一步取证方向，不是自动根因诊断；字段不完整时明确提醒分组可能混合不同负载。
4. 导入候选 B，确认硬件、软件、精度、阶段、负载与计时口径可比较。独立筛选 A/B；比较调用次数变化、P50 比率、原始累计差，以及 `(B mean − A mean) × A count`。完整签名才能做按调用量归一化的比较；新增/消失/签名不全分别列出。还需手动核对转置、属性和融合语义。没有统计显著性声明。
5. 优化情景只计算指定组加速对**累计工作量**的影响，不把它当成端到端加速。需要进一步估算的标准 MatMul/RMSNorm/Softmax 可带入理论页，必须确认布局、算子范围和硬件。未知/融合/量化签名不自动映射。

## 导入与兼容性

- CSV：`kernel_details.csv`、设备逐调用 `op_summary` 风格表；Name/OP Name 或 Type/OP Type，以及 Duration(us)/Task Duration(us) 必需。支持时间列 us/µs/μs/ms/ns/s 单位；无单位列默认拒绝，可明确指定 us/ms/ns。不把 aicore_time 或 Wait Time 当作 task duration。
- CSV 可选 Device ID、Rank ID、Stream ID、Step ID、Start Time(us)/Task Start Time(us)、Input Shapes/Data Types/Formats、Phase / Inference Phase（prefill/decode）。有 Rank ID 时以 rank + device 隔离执行域，不合并不同进程的同号设备。支持 BOM、CRLF、引号内逗号/换行、双引号转义。重复表头、截断引号、聚合 Count 非 1 拒绝；畸形行/无效 duration 计数并跳过。缺失起始时间保留调用统计，但不报告完整时间线指标。
- JSON：Chrome Trace 数组或 `{traceEvents: [...]}`。有 Ascend Hardware/GPU/Device 数字进程标记时只取设备 PID 的完整 `ph:X` 事件计入算子统计；缺少标记时只取 kernel/gpu_kernel/gpu_memcpy/gpu_memset 类别。Host X 事件另存为标记，不混入算子工作量；只有显式选择线程并确认归属/时钟/设备完成边界后才用于阶段和调度统计。B/E 不配对，明确提示。Chrome 的 ts/dur 为 µs，displayTimeUnit 不改变含义。
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

## 单份阶段与利用率诊断

### 阶段计时与调度

- Trace：选择 Host PID/TID，确认对应所选设备/请求、同一时间基准且阶段标记覆盖设备完成。默认精确识别 `prefill` / `decode`、`forward_prefill` / `forward_decode`、`model_forward_prefill` / `model_forward_decode`、`prefill_step` / `decode_step`；调度识别 `scheduler`、`schedule`、`schedule_batch`、`get_next_batch_to_run`。自定义名称可在下拉列表明确映射，覆盖该种标准映射；同名不能映射成多个阶段。
- 无标记时可添加多个手动 Prefill / Decode 区间（相对设备最早任务 µs），最多 1000 条，优先于自动标记。每个 Decode 区间可代表一步。任务 Phase 标签为第三种来源；按 Phase + Step 得到的是**任务包络**，不是完整 forward 时间。没有 Step 时不输出 Decode 步分位数。
- 同阶段嵌套区间先取并集。跨阶段重叠单列“阶段冲突”，不强行归属。各阶段算子耗时按任务与区间交集裁切，所有阶段加未归属/冲突部分严格守恒；原始热点/分位数仍用完整调用。CSV Phase 直接按任务归属；不同 Phase 包络可能重叠，墙钟不能相加。
- 阶段内算子图使用累计任务耗时为分母（允许大于墙钟），Top 6 + 其他堆叠条与水平条、可展开完整分组分页。图区与表格数值可直接校验，不把任务占比误称为墙钟占比。
- Decode 展示可分离步区间的 P50/P95/max、前 200 步柱状图和数值列表（分位数使用全部区间），`>2×P50` 只是长尾候选。嵌套/重叠的 Decode 标记合并计时但禁用逐步分位数，避免重复算 step。
- 调度总覆盖 = 所选 Host 调度记录在观察窗口内的区间并集。阶段间调度 = 该并集与相邻阶段区间之间空隙的交集。没有调度记录时是未知，不是零，也不是整段空隙；“无调度记录覆盖”不等于没有调度成本。调度可与计算重叠，不能相加。
- 另列设备任务未覆盖区间 Top 20、调度记录交集。它是线索，不是空闲或调度归因。Stream/Step/搜索过滤可能移除覆盖，始终显示口径警告。阶段标记可能包含窗口首尾的 Host 工作，因此其跨度可以大于设备首尾任务跨度。
- 不把前向阶段直接当作 TTFT/TPOT，不假设一个 Decode step 对应一个 token；没有请求/token 边界或完整依赖图，就不输出这些服务级指标。

### 低活跃算子

读取逐任务 CSV 或 Trace args 中 `aic_mac_ratio` / `aic_cube_ratio`、`aiv_vec_ratio`、`aic_mte2_ratio`、`aiv_mte2_ratio`、`aic_scalar_ratio`、`aiv_scalar_ratio`。列名 `(%)` / `%` 后缀或值的 `%` 后缀可明确百分比；无单位的 ratio 必须由用户确认 0–1 或 0–100，**不按数值大小猜测**。N/A、空值和越界值不作零处理；真实零值保留。

自动建议只将 MatMul/GEMM 对应 Cube、常见向量算子对应 Vector；融合或未知类型可手动指定六种指标。按低于用户阈值（默认 30%）的调用累计耗时排序，列出任务时长加权活跃率、有效样本数/总样本数、有效耗时覆盖率、低活跃调用数和耗时。可筛选低活跃候选并分页。

这是**流水线 cycle 比例的诊断线索**，不是峰值 FLOPS 或全芯片利用率。跨调用加权采用 task duration，不声称等于硬件总周期加权；Vector 算子的 Cube 零值可能完全正常，MTE 活跃比也不是带宽利用率。单指标阈值不做 bound、布局问题或优化收益的确定归因。没有 Counter 时完整保留耗时分析，并提示补采 Level1 / PipeUtilization，按实际 CANN 版本确认字段。

匿名报告版本 2 增加阶段数值、Decode 分位数、调度覆盖和匿名 U 编号的指标统计；不导出用户阶段名称、Host 线程、原始时间戳、手动区间或算子签名。清空/刷新/离开性能板块同样移除标记和配置。

### 方法参考

参考用户指定的 [CANNBot ops-profiling](https://gitcode.com/cann/cannbot-skills/blob/edcd4b94390c2a6b664f0935fbdd8a65e3644e9f/ops/ops-profiling/SKILL.md) 与其 CSV 字段文档，区分 PipeUtilization、任务耗时和理论算力指标；参考 [model-infer-perf-breakdown](https://gitcode.com/cann/cannbot-skills/blob/edcd4b94390c2a6b664f0935fbdd8a65e3644e9f/model/model-infer-perf-breakdown/SKILL.md) 的并集/间隙及重叠统计方法。

本功能是浏览器内独立实现，没有安装远端插件或运行它的 NPU 采集脚本，也没有宣称执行其需要真实采样、模型源码和人工确认的完整逐层拆解工作流。不复制它的自动 bound 结论；阈值只形成待核查候选。

## 证据与边界

字段核对：[CANN op_summary 指标说明](https://www.hiascend.com/doc_center/source/zh/CANNCommunityEdition/910beta2/devaids/Profiling/atlasprofiling_16_0067.html)。原始 Task Duration 可能包含任务调度/响应，不是纯 Cube 周期。

设备/Host 分层与标准工具参考：[MindStudio Insight System Tuning](https://www.hiascend.com/document/detail/en/mindstudio/2610/visualization_tool/MindStudioInsight/docs/en/user_guide/system_tuning.md)。需要流水线证据时使用 Level1 + PipeUtilization，并按版本验证采集字段；内存问题可另采 Memory/L2Cache。本版不凭利用率阈值做自动 roofline 归因。

本版已验证格式适配与分析数学，但尚未收到用户真实 trace；未宣称兼容所有 CANN 版本或替代 MindStudio。真实数据遇到不同列名或事件布局时，应显式报错或降级，不能编造缺失指标。

## 验证

`npm run test:profiling`：CSV/JSON、单位、畸形输入、设备隔离、时间窗口、随机区间独立 oracle、分位数、A/B 调用量归一化、匿名导出、理论桥接、50000 任务统计与预览限量。

`npm run test:profiling:browser`：四种屏幕尺寸、真实 Worker 导入、合成示例、筛选错误恢复、A/B 确认、热点校核并返回保留、匿名下载、恶意输入无脚本执行/外发、清空与刷新无持久化。

新增单份诊断测试覆盖 Host 归属确认、阶段并集、调度交集、跨边界任务工作量守恒、随机逐时间单元独立 oracle、比例单位/缺失/零值、3 万阶段的全量统计与限量绘图；浏览器覆盖示例的精确计时与图表值、手动区间、错误映射恢复、匿名导出和隐私生命周期。尚未收到真实用户采样，不能宣称支持所有生产框架的事件命名；未识别名称需明确映射或手动标注。
