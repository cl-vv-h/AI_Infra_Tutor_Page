## 01 · 这份案例能教你什么

本教程依据一份本地 Ascend PyTorch Profiler 输出的<strong>文件结构、字段与任务类型</strong>编写。它包含 Kernel 明细、设备时间线、任务表，以及 Host API、框架算子、Step 汇总。可以用来练习“汇总找候选 → 时间线看上下文 → 回到字段验证”的分析方法。

案例中可见 `NOTIFY_WAIT`、`DAVID_EVENT_WAIT`、`MoeLowLatencyDispatchV2`、`MoeLowLatencyCombineV2`、`GroupedMatmul` 等记录，也可见 `TARGET_VERIFY` 阶段标记。后者提示存在目标模型验证阶段；<strong>不能把整个采样直接称为普通 Decode</strong>，更不能仅凭标记推导投机接受率或每个请求的延迟。

公开教程不包含原始采样、真实耗时、Shape、机器标识、调用栈或本地路径。下文所有带数值的演算均为<strong>合成教学示例</strong>，不代表本次采样的性能结论。算子名称是阅读入口，不是对模型、芯片型号或通信实现的确定鉴定。

<strong>第一次阅读只做三件事：</strong>先看第 02 节选择文件，再读第 04–05 节理解 Notify 与 MoE，最后跟第 09 节完成一次分析。其他章节按需查阅。

## 02 · 目录里的文件分别回答什么问题

优先打开解析后的 `ASCEND_PROFILER_OUTPUT`，不要从原始二进制或数据库逐个猜起。同一采样的文件可以互补，但不是互相独立的多份工作量。

| 文件 | 主要用途 | 阅读时的边界 |
| --- | --- | --- |
| `trace_view.json` | 查看 Host、CANN、Ascend Hardware 的时序和可用关联 | 嵌套范围、Host 下发与 Device 执行不能重复累加 |
| `kernel_details.csv` | 按算子找热点，读取 Shape、dtype、时长与流水线计数器 | 通常不覆盖全部等待、控制和 DMA 任务 |
| `task_time.csv` | 查看更广的设备任务起止时间与任务类型 | 与 trace 中的硬件任务可能是同一批记录，不能再加一遍 |
| `op_statistic.csv` | 按算子类型看 Count、总时长、平均值和最大值 | 类型相同不代表 Shape、阶段或精度相同 |
| `api_statistic.csv` | 查 Host 侧 API 的调用次数和时间 | API 久不等于 NPU 正在算；同步 API 常包含等待 |
| `operator_details.csv` | 对照框架算子的 Host / Device、Self / Total | 父子范围存在包含关系，Total 不能跨层直接相加 |
| `step_trace_time.csv` | 查看迭代的计算、通信、重叠等汇总 | Step 留空不等于“只有一个 token”或“只执行一步” |
| `analysis.db`、`ascend_pytorch_profiler_<rank>.db` | 供配套分析工具查询 | 本站不直接解析 DB；文件名中的编号也不要当作全局拓扑说明 |
| `analyse.done` | 解析流程的完成标记 | 不证明采样窗口、采集项或跨 rank 数据完整 |

文件与字段会随工具版本变化，不能用“必须有固定列数”判断采样是否有效。CSV 和 DB 的同名指标也可能使用不同时间单位。文件格式参考 [Ascend PyTorch Profiler 输出说明](https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/850/devaids/profiling/atlasprofiling_16_1149.html)。

<strong>在本站操作：</strong>返回工作台，在基线 A 选择输出目录；B 留空即可。先核对“任务完整性”和 Kernel 关联结果，再读热点。汇总表缺失时，不能靠其他文件臆造 Host 或 Step 信息。本站不上传文件；要查看完整依赖连线和多 rank 通信细节，使用本地 MindStudio Insight。

## 03 · 时间线：先分层，再看同一段时间

| 层级 | 你在观察什么 | 最容易混淆的地方 |
| --- | --- | --- |
| Python / 框架 | 调度、模型调用、用户标记、框架算子范围 | 一个范围可能下发多个设备任务，或等待此前任务 |
| CANN / Runtime | API 调用与任务提交 | 异步调用返回不代表设备执行完毕 |
| Ascend Hardware | 各 Stream 上实际记录的计算、拷贝、同步和控制任务 | 跨 Stream 不能仅凭横向邻近判定依赖 |
| Communication / HCCL（如采集到） | 通信域、同步、传输、rank 关系 | 不一定覆盖所有自定义或融合通信路径 |
| Overlap Analysis | 计算、通信等区间的派生投影 | 不是另一批设备任务，不应重复计数 |

<strong>Stream（流）</strong>是任务的执行序列。<strong>Rank</strong>是分布式进程在某通信组中的编号，<strong>Device ID</strong>是设备标识，<strong>Task ID</strong>是任务标识；三者不能互换。图重放或不同上下文中 Task ID 可能重复，定位任务时还要核对设备、物理 Stream、起止时间与可用关联信息。

建议先选一段稳定、同阶段的窗口，同时看 Host 下发和 Device 执行；再放大到一个算子，查看其详情、关联的提交 API 与前后同步。若存在 `connection_id` 或工具提供的下发连线，用它追踪关联；没有关联证据时，明确写“尚未确认”。官方的 [Timeline 分析方法](https://www.hiascend.com/document/detail/zh/mindstudio/81RC1/practicalcases/GeneralPerformanceIssue/toolsample6_022.html) 也以分层和跨卡对照为基础。

<strong>不要这样读：</strong>看到两个矩形重叠，就认为获得了相同幅度的加速；看到某条流空白，就认为整张卡空闲。其他流可能仍在执行，采集和筛选也可能隐藏任务。

## 04 · Notify、Event：到底在等什么

<strong>Notify 是同步通知机制，不是一个模型层，也不是数据载荷本身。</strong>在典型 HCCL 编排中，Record 发布同步信号，Wait 等待对应条件满足后才允许依赖它的后续任务推进。一次通信内部可能既有同步任务，也有实际拷贝或传输任务。[HCCL 通信算子执行说明](https://www.hiascend.com/document/detail/zh/CANNCommunityEdition/900beta2/commlib/hcclug/hcclug_000018.html)

| 案例中出现的任务类型 | 应如何理解 | 不能直接得出的结论 |
| --- | --- | --- |
| `NOTIFY_RECORD` | 发布通知的控制任务 | 不是“传输了多少 token”的记录 |
| `NOTIFY_WAIT` | 等待通知条件的同步任务 | 长等待不等于链路带宽低，也不自动证明来自远端 rank |
| `DAVID_EVENT_RECORD` | Event 记录类控制任务 | 名称不能确定具体业务操作 |
| `DAVID_EVENT_WAIT` | Event 等待类任务，需查事件关联 | 不应把它和某个 HCCL Notify 强行一一配对 |
| `DAVID_EVENT_RESET` | Event 重置类控制任务 | 不是重新计算一次模型 |
| `MODEL_EXECUTE` | 模型／图执行相关控制或包络记录 | 不应与内部 Kernel 时长重复算作计算工作量 |

Event 也用于 Stream 之间的依赖表达。例如生产者流完成所需任务后记录 Event，消费者流等待该 Event，再读取对应结果。Host 提交等待任务与 Device 实际等待是两个观察层次。参考 [AscendCL Stream 间同步说明](https://www.hiascend.com/doc_center/source/zh/canncommercial/70RC1/inferapplicationdev/aclcppdevg/aclcppdevg_000102.html)。`DAVID_*` 在这里仅按采样的任务类别解释，不据此猜测硬件内部实现或通知对象。

### 长 Notify Wait 的排查顺序

1. 确定等待属于哪次执行、哪条流、哪个通信域。若有 `notify_id`、源／目标 rank 等详情，记录这些关联；若没有，先承认不知道在等谁。
2. 对照对应的生产者或其他 rank：是否尚未到达同一次通信？其前置计算是否更长？Host 是否更晚下发？
3. 对 MoE，检查每个专家／rank 的 token 工作量与专家计算时间是否不均衡。
4. 再结合实际传输区间、数据量、链路与错误指标检验网络假设。不能把含等待的通信总时长直接用于估算纯传输带宽。

快卡可能因为先到同步点而“等待更久”；真正的慢卡反而等待短。先后到达差异会计入通信算子时间，官方称为[快慢卡现象](https://www.hiascend.com/document/detail/zh/CANNCommunityEdition/850alpha002/hccl/hcclug/hcclug_000020.html)。单个 rank 的采样只能提出候选，不能定位全组最慢的根因。

### 合成示例：等待发生了，不等于都暴露在外

假设同一设备、同一筛选窗口中，Wait A 覆盖 `[0, 80)` µs，Wait B 覆盖 `[20, 60)` µs，另一条流的执行覆盖 `[0, 70)` µs。

| 口径 | 演算 | 结果 |
| --- | --- | --- |
| 累计等待 | 80 + 40 | 120 µs，跨流重复计时 |
| 等待区间并集 | `[0, 80)` | 80 µs，时间轴上去重 |
| 未被执行覆盖的等待 | `[70, 80)` | 10 µs，相对于当前可见执行 |

这 <strong>10 µs 不是已经证明可消除的端到端损失</strong>。依赖、其他设备、未采集任务和后续执行都可能影响结论。工作台的“同步等待”区块用这三种口径帮助你避免误加。

## 05 · MoE：Dispatch 和 Combine 在做什么

MoE（混合专家）中，路由器为 token 选择专家。EP（专家并行）把不同专家放到不同 rank。<strong>Dispatch 解决“把输入送给被选中的专家”，Combine 解决“把专家结果带回来并还原为 token 输出”。</strong>它们不是普通 CPU 线程调度，也不是简单地切分与拼接权重。

| 阶段 | 数据如何变化 | 在本案例中可作为线索的名称 |
| --- | --- | --- |
| 路由 Routing | 为 token 生成 top-k 专家选择及相应路由权重 | `MoeGatingTopK` |
| 分发 Dispatch | 按专家／目标 rank 组织 token，传递数据和恢复映射所需元信息；可能融合量化 | `MoeLowLatencyDispatchV2` |
| 专家计算 Experts | 各专家处理分配给自己的 token；一组不同大小的矩阵乘可合并执行 | `GroupedMatmul`、`SwiGlu` 等，需结合关联确认 |
| 合并 Combine | 将结果送回来源，恢复 token 顺序，按路由规则归约多个专家结果 | `MoeLowLatencyCombineV2` |

以公开 CANN 接口为例，Dispatch 可包含 EP 域的 AllToAllV；部分产品／版本还支持 TP 域操作和可选量化。Combine 使用匹配的路由元信息回收结果，可在此处进行加权求和；若上游已经加权，接口也可能直接求和。<strong>权重只能按实现约定应用，不能重复乘。</strong>参见 [Dispatch V2 文档](https://www.hiascend.com/document/detail/zh/CANNCommunityEdition/83RC1alpha002/API/aolapi/context/aclnnMoeDistributeDispatchV2.md) 与 [CANN Combine V2 文档](https://gitcode.com/cann/ops-transformer/blob/master/mc2/moe_distribute_combine_v2/docs/aclnnMoeDistributeCombineV2.md)。

这些文档用于解释语义，<strong>不把本案例的 `MoeLowLatency*` Kernel 自动认定为某个 `aclnnMoeDistribute*` API</strong>。还需要运行时版本、Host 调用链和源码证据。融合实现也不一定在时间线上显示独立的 AllToAll；没有单独通信条目不等于没有跨卡通信。

### 用两个 token 算一次分发和合并

<strong>合成示例：</strong>两个 rank，rank 0 持有专家 E0，rank 1 持有专家 E1；忽略共享专家、TP、容量限制和量化。两个 token 原本都在 rank 0，top-k = 2。

| Token | 路由到 E0（rank 0） | 路由到 E1（rank 1） | 最终输出 |
| --- | --- | --- | --- |
| A | 权重 0.75 | 权重 0.25 | `yA = 0.75 × E0(A) + 0.25 × E1(A)` |
| B | 权重 0.20 | 权重 0.80 | `yB = 0.20 × E0(B) + 0.80 × E1(B)` |

1. <strong>Dispatch：</strong>产生四个 token–expert 分配项。E0 的两项保留在本 rank；E1 的两项需要送往 rank 1。逻辑分配项数不等于网络报文数，实际实现可能打包、对齐或复用数据。
2. <strong>Experts：</strong>E0 和 E1 各处理两个 token。此时按专家组织的顺序，不一定等于最初的 token 顺序。
3. <strong>Combine：</strong>E1 的结果返回 rank 0，与本地 E0 结果按 A、B 对齐，再得到上表的两个加权输出。

如果实际路由使一个 rank 收到更多 token，它的专家计算可能更晚完成，其他 rank 的 Combine 或同步便可能等待。需要查看<strong>每专家 token 分布与跨 rank 时序</strong>；仅看到本 rank 的 Combine 很长，还不能断言专家负载失衡。

### 几个相近词，不要混用

| 名称 | 核心语义 |
| --- | --- |
| AllToAll / AllToAllV | 各 rank 将不同分片发给不同对端；V 版本允许传输计数变化 |
| AllGather | 把各 rank 的分片收集到组内每个 rank |
| ReduceScatter | 先按规则归约，再将结果分片交给不同 rank |
| AllReduce | 归约后，各 rank 得到完整归约结果 |
| PyTorch dispatcher | 根据算子与后端等选择实现；不是 MoE 的 token 分发 |

因此，MoE Combine 不等于 AllGather，Dispatch 也不等于某一种固定通信算法。逻辑阶段与底层实现要分开讨论。

## 06 · 其余常见条目怎么读

下面的名称或任务类型均可在案例中找到。表中的用途是阅读方向，具体输入与融合边界仍以实现为准。

| 条目 | 阅读要点 |
| --- | --- |
| `GroupedMatmul` | 多组矩阵乘；查看各组大小和 dtype。出现在 MoE 附近是专家计算候选，不是充分证明 |
| `MatMulV3`、`TransposeBatchMatMul` | 矩阵乘相关计算；区分输入规模、转置与布局，不能只按名称比较时长 |
| `KvQuantSparseFlashAttention`、`SparseFlashAttention` | 注意力相关候选；结合 KV 长度、稀疏模式、精度和阶段分析，不套用普通全量 Attention 工作量 |
| `Cast`、`DynamicQuantV2` | 类型转换或量化；量化成本与之后的计算／搬运收益应一起验证 |
| `Transpose`、`ViewCopy`、`GatherV2`、`ScatterNdUpdate` | 布局、索引和数据组织；可能实际搬运数据，不因“只是改形状”就忽略 |
| `RmsNorm`、`AddRmsNorm`、`SwiGlu` | 归一化、融合残差或门控激活；小 Shape 下需关注调用频率与下发开销 |
| `AI_CORE`、`AI_VECTOR_CORE`、`MIX_AIC`、`MIX_AIV` | 执行资源／任务类别，不是模型层名；类别本身不能判定算力或带宽瓶颈 |
| `SDMA_SQE`、`UBDMA` | DMA 搬运类硬件任务；是否跨设备、搬多少，需要具体详情，不能全部算作网络通信 |

同一搬运任务在任务表中可能标为 `MEMCPY_ASYNC`，在 trace 中显示更具体的 DMA 类型。关联时不应只要求名称完全相同。反过来，同名算子也可能来自不同层、不同 Shape 或不同图重放。

## 07 · 时长、占比、利用率：先统一口径

<strong>墙钟时间</strong>是一个明确窗口从开始到结束的时间。<strong>累计任务时长</strong>是把各调用时长相加；跨流重叠时可能大于墙钟时间。若一个窗口长 100 µs，两条流各执行 80 µs，累计就是 160 µs——这不是“设备利用率 160%”。这是合成演算，不是案例测量。

| 字段或指标 | 正确读法 |
| --- | --- |
| `Start Time(us)`、`Duration(us)` | 按单位理解任务位置和持续时间；1 ms = 1000 µs |
| `Wait Time(us)` | 工具报告的算子等待／任务间隔字段；不是所有 `NOTIFY_WAIT` 区间之和，需核对当前版本定义 |
| Count / Total / Avg / Max | 同时看调用频率、累计成本与长尾；最大值不能代表稳态典型性能 |
| `Ratio(%)` | 先查统计分母；算子类型累计时长占比，不自动等于端到端耗时占比 |
| Host Self / Total | Self 排除子范围，Total 包含子范围；父子 Total 叠加会重复计时 |
| Device Self / Total | 反映关联到框架范围的设备任务统计；不能与 Host 时间相加当端到端延迟 |

形状和阶段变化会改变工作量。比较热点时至少对齐算子类型、Shape、dtype、布局与执行阶段；“调用减少”与“单次变快”是不同优化效果。[Profiler 字段说明](https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/850/devaids/profiling/atlasprofiling_16_1149.html)

例如 MindStudio 的 Kernel Details 将 `Wait Time(us)` 解释为前一任务结束到当前任务开始的间隔。它是任务间隔口径，不是“当前 Kernel 在内部等网络多久”；也不能不加判断地按 CSV 行顺序相减重建。参考 [Kernel Details 字段定义](https://www.hiascend.com/document/detail/zh/mindstudio/70RC1/GUI-baseddevelopmenttool/msascendinsightug/AscendInsight_0019.html)。

### 流水线指标不是一张相加为 100% 的饼图

| 指标族 | 反映什么 | 下一步验证 |
| --- | --- | --- |
| `aic_mac_ratio` / MAC time | Cube 矩阵指令流水的活动占比／时间 | 结合矩阵规模、精度、分块与运算量，不等同于峰值算力利用率 |
| `aiv_vec_ratio` | Vector 流水活动占比 | 检查逐元素、归一化、量化等任务的规模和搬运 |
| `aic_*mte*_ratio`、`aiv_*mte*_ratio` | 搬运流水活动占比；不同 MTE 对应不同数据路径 | 高占比是搬运压力线索，不是实测 GB/s，也不直接证明 HBM 饱和 |
| Scalar / FixPipe | 标量控制、后处理等流水活动 | 检查控制开销与计算／搬运的组织方式 |
| `cube_utilization(%)` | 工具定义的 Cube 运算效率指标 | 与 MAC 活动占比区分，核对设备与版本支持情况 |

流水之间可以并行，比例不能简单相加。原始值 `0.8` 在采用 0–1 比例的字段中表示 80%；带 `(%)` 的列按百分数口径读，不能所有列都乘 100。空值或 `N/A` 表示未知／未支持，不是零。字段定义参见 [CANN 算子明细](https://www.hiascend.com/document/detail/zh/CANNCommunityEdition/82RC1alpha001/devaids/Profiling/atlasprofiling_16_0067.html) 与 [MindSpeed 流水线字段解读](https://www.hiascend.com/document/detail/en/MindSpeed/2610/LLM/MindSpeed_LLM/docs/en/pytorch/tuning/fsdp2_backend_performance_optimization.md)。

<strong>结论要保留证据层级：</strong>“MTE 活跃偏高”是观察；“可能受数据搬运约束”是假设；控制变量实验后吞吐／延迟改善，才是对假设的支持。缺少数据量和硬件峰值时，不报告推算带宽利用率。

## 08 · Host、Step 与推理阶段

在 `api_statistic.csv` 中看到 `aclrtSynchronizeStream` 或 `aclrtSynchronizeDeviceWithTimeout` 时，先问：Host 在等什么设备工作完成？同步函数用时很长，可能只是把已有设备执行的等待显式计到了 Host，而不是 CPU 自己计算慢。`aclmdlRIExecuteAsync` 则是异步执行相关接口，Host 调用时长也不是整个图的设备耗时。

框架标记如 `scheduler.run_batch`、`scheduler.get_next_batch_to_run` 帮你定位调度边界；`step[TARGET_VERIFY …]` 帮你识别验证阶段。但 <strong>Prefill、Decode、Draft、Target Verify 不能只用矩形宽窄来猜</strong>。一次验证可能处理多个候选位置，接受多少 token 还需应用侧统计。TTFT（首 token 延迟）和 TPOT（输出 token 间时间）也需要请求与 token 的端到端时间记录，不能用一个 Kernel 或 Host 范围代替。

`step_trace_time.csv` 的 `Communication(Not Overlapped)` 是通信与计算重叠分析后的口径；`Free` 可能包含初始化、数据准备、CPU 工作等，不能直接叫“NPU 纯空闲”。`Preparing` 描述迭代开始到首个计算或通信任务之间的区间。[Step 字段说明](https://www.hiascend.com/document/detail/zh/CANNCommunityEdition/800alpha001/devaids/devtools/profiling/atlasprofiling_16_0035.html)

本案例的 Step 汇总没有可用的 Step 编号。因此应结合 trace 中的实际标记选窗口，不假定 CSV 的一行就是完整的一次 Decode。本站中的 Host／Step 独立汇总保持整份采样口径，<strong>不会随设备窗口筛选重新归因</strong>，不能拿它与筛选后的设备值做无条件对减。

## 09 · 跟着工作台做一次分析

1. <strong>核对导入。</strong>在基线 A 选择输出目录，打开“数据与诊断总览”，确认执行、等待、控制三类记录，以及 Kernel 关联和未读取文件。不同表行数不同未必是丢数据；先看覆盖范围和去重规则。
2. <strong>限定问题。</strong>例如“验证阶段一段稳定窗口为什么更慢”，而不是“整个模型哪里不好”。在“范围与稳态筛选”选设备和相对时间，排除预热、编译、不相关阶段。本站只保留完整落入窗口的调用，跨边界任务会被排除，选窗时留出上下文。
3. <strong>读总览而不急着定因。</strong>看执行覆盖、同步等待、候选证据。把累计任务时长、区间并集、未被执行覆盖的等待分开记录；改变筛选后，口径也随之改变。
4. <strong>追一个 MoE 候选。</strong>在热点或任务搜索中查 `MoeLowLatencyDispatchV2`、`GroupedMatmul`、`MoeLowLatencyCombineV2`。先确认同阶段、同次执行的关联，再比较时长、Shape 与调用频率。名称相邻不能证明它们属于同一层。
5. <strong>回到完整时间线。</strong>在本站用聚焦区间与 Stream 行缩小范围；在本地 MindStudio Insight 对照完整 Host–Device 关联、同步依赖和对端 rank。若 Notify 较长，从等待对象往前追，而不是先改通信参数。
6. <strong>补读独立汇总。</strong>展开“Host 与汇总证据”，分别查看框架、API、Step。注意这些表仍是整份采样；原始阶段标记只是边界线索，不是自动归一化后的推理阶段。
7. <strong>形成一个可检验假设。</strong>例如“部分 rank 的专家输入更大，导致它们到达 Combine 更晚”。列出缺少的证据：各专家 token 数、同一迭代的跨 rank trace、路由与部署配置。
8. <strong>做同条件 A/B。</strong>保持模型、并行配置、精度、请求负载、阶段与采集方式一致，一次只改一个因素，多次独立重复；既看任务变化，也看应用端吞吐、延迟与正确性。

建议用这样的分析记录，明确区分观察与推断：

```text
问题：同一推理阶段的延迟是否受专家负载分布影响？
观察：某同步点等待较长；当前只有单个 rank 的设备证据。
假设：对端专家计算更晚完成，可能与 token 分配不均有关。
缺口：缺少对端时序、每专家 token 数和对应通信关系。
验证：补齐同一次运行的相关 rank，按关联确认到达顺序。
验收：相同负载与正确性下，多次复测端到端延迟和吞吐。
```

这是一份<strong>待验证的分析模板</strong>，不是对案例的瓶颈诊断报告。

## 10 · 常见误判与补采建议

| 看到的现象 | 不要直接下结论 | 应补的证据 |
| --- | --- | --- |
| Notify Wait 很长 | 网络一定慢 | 等待对象、对端到达时间、前置计算／下发与实际传输 |
| Combine 比 Dispatch 长 | 通信实现有 bug | 返回数据与聚合精度、专家完成时刻、融合工作量 |
| MTE 占比高、MAC 占比低 | 一定 memory-bound | 数据量、缓存／带宽指标、算术强度、相同 Shape 对照 |
| 很多短 Kernel | 全部融合一定更快 | 下发间隙、依赖、资源压力、融合后的正确性与端到端收益 |
| 通信与计算有重叠 | 所有通信成本被隐藏 | 真实传输与等待的区分、资源争用、依赖与最终延迟 |
| 某流有空白、Free 偏大 | 整张设备空闲 | 其他流、Host 工作、采集范围及未覆盖任务 |
| 优化后算子平均更短 | 服务一定更快 | 工作量／调用数、阶段组成、吞吐、尾延迟与重复实验 |

若需要补采，优先使用项目已有的 profiling 开关，在预热后采少量稳态迭代。需要逐任务流水线证据时，按当前 `torch_npu`／CANN 版本启用 <strong>Level1 + PipeUtilization</strong>；Shape、调用栈、内存或额外计数器按问题选择，避免无差别开启引入过大开销。流水计数器在不同硬件与版本上可能有支持差异；不要仅凭 CSV 列数判断成功。

跨 rank 等待分析需要相关通信组同一次运行的数据，并核对时钟对齐与迭代对应关系。不要把不同实验的时间轴直接叠在一起。重新采集前应明确权限、采样成本和敏感信息范围；本教程不会自动运行采集，也不提供未经版本核对的一键采集脚本。

## 11 · 自测：你是否真的读懂了

<details>
<summary>Notify Wait 占 80 µs，能说网络传输花了 80 µs 吗？</summary>

不能。Wait 描述等待同步条件；对端尚未到达、上游计算或 Host 下发更慢，都可能产生等待。需要单独确认真实传输和数据量。

</details>

<details>
<summary>MoE top-k = 2，两个 token 是否必须产生四次网络发送？</summary>

不必。它产生四个逻辑 token–expert 分配项，但其中可能有本地专家，跨卡数据也可能打包、去重或融合发送。分配项数不是报文数。

</details>

<details>
<summary>MAC 为 80%，MTE 为 70%，加起来超过 100% 是错误吗？</summary>

不一定。不同流水可以重叠活动，不是互斥时间分区。还应先核对原始字段使用的是比例还是百分数。

</details>

<details>
<summary>单 rank 上 Combine 很慢，可以确定哪一个专家拖慢全局吗？</summary>

不能。要关联具体执行、对端 rank、每专家 token 分布与完成时间。当前最多得到需要验证的候选。

</details>

<details>
<summary>读完教程返回工作台，数据还在吗？</summary>

在性能板块内往返，内存分析保留；刷新页面或离开性能板块后需要重新导入。原始文件不上传、不写入本地持久存储。即使导出匿名统计，业务性能数值本身仍可能敏感，分享前请审核。

</details>

最终目标不是记住所有算子名字，而是能够写清楚：<strong>在哪个范围内看到了什么、它支持哪个假设、还缺什么证据，以及怎样验证。</strong>
