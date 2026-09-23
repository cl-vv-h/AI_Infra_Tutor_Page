// Analytical, single-device model. Rates are decimal (TFLOP/s, GB/s); time is µs.
export const estimatorVersion = '1.0'
export const hardwareSources = {
  ascend950: 'https://public-download.obs.cn-east-2.myhuaweicloud.com/ascend/昇腾950%20NPU架构白皮书.pdf',
  ascend910: 'https://arxiv.org/html/2506.12708v2#S3.SS3.SSS1',
  indexer: 'https://github.com/hicann/ops-transformer/blob/master/attention/lightning_indexer/docs/aclnnLightningIndexer.md',
  profiler: 'https://www.hiascend.com/doc_center/source/zh/CANNCommunityEdition/910beta2/devaids/Profiling/atlasprofiling_16_0067.html',
}
export type Precision = 'bf16' | 'fp16' | 'fp8' | 'int8' | 'mxfp4'
export type Operator = 'matmul' | 'indexer' | 'rmsnorm' | 'softmax' | 'gather'
export interface Hardware {
  id: string; name: string; scope: string; bandwidth: number; capacity: number
  cube: Partial<Record<Precision, number>>; vector: number; source: string; note: string
}
export const hardwareProfiles: Hardware[] = [
  { id: '910c', name: 'Ascend 910C · 单 die', scope: '单 die / 本地 HBM', bandwidth: 1600, capacity: 64,
    cube: { bf16: 375, fp16: 375, int8: 750 }, vector: 10, source: hardwareSources.ascend910,
    note: '论文确认单 die 64 GB / 1.6 TB/s。此处 Cube 375 TFLOP/s（INT8 750 TOP/s）与 Vector 10 TFLOP/s 是可编辑情景假设，非已核验官方峰值；请用设备规格或微基准替换。不可将双 die 总带宽用于单 kernel。' },
  { id: '950pr', name: 'Ascend 950PR · 32 Cube', scope: '单芯片 / 32 Cube SKU', bandwidth: 1600, capacity: 128,
    cube: { bf16: 432, fp16: 432, fp8: 865, int8: 865, mxfp4: 1730 }, vector: 27, source: hardwareSources.ascend950,
    note: '官方白皮书表 3-1，32 Cube / 64 Vector 版本。矩阵计算只使用 Cube 峰值，不使用 Cube+Vector 总算力；Vector 采用 FP32 峰值。' },
  { id: '950pr-28', name: 'Ascend 950PR · 28 Cube', scope: '单芯片 / 28 Cube SKU', bandwidth: 1400, capacity: 112,
    cube: { bf16: 378, fp16: 378, fp8: 756, int8: 756, mxfp4: 1513 }, vector: 23, source: hardwareSources.ascend950,
    note: '官方白皮书表 3-1，28 Cube / 56 Vector 版本。与 32 Cube 版本区分；频率、功耗及具体 SKU 仍需现场确认。' },
  { id: '950dt', name: 'Ascend 950DT · 36 Cube', scope: '单芯片 / 36 Cube SKU', bandwidth: 4000, capacity: 144,
    cube: { bf16: 486, fp16: 486, fp8: 973, int8: 973, mxfp4: 1946 }, vector: 30, source: hardwareSources.ascend950,
    note: '官方白皮书表 3-1，36 Cube / 72 Vector、144 GB 版本；不是所有 950DT SKU 的统一配置，也不是实机性能承诺。' },
  { id: 'custom', name: '自定义设备', scope: '用户定义的单执行域', bandwidth: 1000, capacity: 64,
    cube: { bf16: 100, fp16: 100, fp8: 200, int8: 200, mxfp4: 400 }, vector: 10, source: '',
    note: '全部数值为演示占位假设，必须按目标设备修改。不得混合单 die 算力、整卡带宽与跨卡 shape。' },
]
export const operatorNames: Record<Operator, string> = { matmul: 'MatMul / Batched MatMul', indexer: 'Lightning Indexer', rmsnorm: 'RMSNorm', softmax: 'Softmax', gather: 'Gather（按行索引）' }
export interface EstimateInput {
  operator: Operator; precision: Precision; batch: number; m: number; n: number; k: number
  queries: number; sequence: number; heads: number; dim: number; topk: number
  rows: number; width: number; selected: number; causal: boolean; materialize: boolean; broadcastB: boolean
  bandwidth: number; cube: number; vector: number; capacity: number
  computeEfficiency: number; memoryEfficiency: number; vectorEfficiency: number
  selectionRate: number; overhead: number; trafficFactor: number
}
export function defaultEstimate(hardware = hardwareProfiles[0]): EstimateInput {
  return { operator: 'matmul', precision: 'bf16', batch: 1, m: 4096, n: 7168, k: 2048,
    queries: 1, sequence: 32768, heads: 64, dim: 128, topk: 2048,
    rows: 4096, width: 7168, selected: 1024, causal: false, materialize: false, broadcastB: true,
    bandwidth: hardware.bandwidth, cube: hardware.cube.bf16!, vector: hardware.vector, capacity: hardware.capacity,
    computeEfficiency: 0.45, memoryEfficiency: 0.65, vectorEfficiency: 0.3,
    selectionRate: 50, overhead: 3, trafficFactor: 1 }
}
export interface Workload {
  cubeOps: number; vectorOps: number; comparisons: number; bytes: number; footprint: number
  shapes: string[]; formulas: string[]; warnings: string[]
}
const positive = (n: number, name: string, max = 1e9) => {
  if (!Number.isFinite(n) || n <= 0 || n > max) throw new Error(`${name} 必须为大于 0、且不超过 ${max} 的有限数值。`)
}
const integer = (n: number, name: string) => {
  positive(n, name, 1e7)
  if (!Number.isSafeInteger(n)) throw new Error(`${name} 必须为正整数。`)
}
export function workload(input: EstimateInput): Workload {
  const x = input
  if (!Object.keys(operatorNames).includes(x.operator)) throw new Error('未知算子。')
  if (!['bf16','fp16','fp8','int8','mxfp4'].includes(x.precision)) throw new Error('未知精度。')
  if (x.operator !== 'matmul' && !['bf16','fp16'].includes(x.precision)) throw new Error('此算子的当前建模范围仅包含 BF16 / FP16。')
  const w: Workload = { cubeOps: 0, vectorOps: 0, comparisons: 0, bytes: 0, footprint: 0, shapes: [], formulas: [], warnings: [] }
  if (x.operator === 'matmul') {
    for (const key of ['batch','m','n','k'] as const) integer(x[key], key)
    const { batch: b, m, n, k } = x
    const a = b*m*k, weight = (x.broadcastB ? 1 : b)*k*n, out = b*m*n
    const bytes = x.precision === 'mxfp4' ? 0.5 : ['int8','fp8'].includes(x.precision) ? 1 : 2
    const scales = x.precision === 'mxfp4' ? b*m*Math.ceil(k/32) + (x.broadcastB ? 1 : b)*n*Math.ceil(k/32) : x.precision === 'int8' || x.precision === 'fp8' ? 4*(b*m+(x.broadcastB ? 1 : b)*n) : 0
    w.cubeOps = 2*b*m*n*k
    w.bytes = (a+weight)*bytes + 2*out + scales
    w.footprint = w.bytes
    w.shapes = [`A [${b}, ${m}, ${k}]`, `B [${x.broadcastB ? 1 : b}, ${k}, ${n}]`, `C [${b}, ${m}, ${n}] · BF16/FP16`]
    w.formulas = ['F = 2·B·M·N·K（FMA = 2 ops）', 'D = A + B + C 的字节数 + scale；B 广播时仅计一次权重读取。']
    if (bytes < 2) w.warnings.push('量化输入已预先生成；不含在线量化或反量化 epilogue 的独立计算成本。INT8/FP8 假设 A 按行、B 按输出通道 FP32 scale；MXFP4 假设 K 方向每 32 元素 1 字节 scale。不同格式需校准效率、固定开销及流量放大系数。')
    if (Math.min(m,n,k) < 128 || n%16 || k%16) w.warnings.push('小矩阵或尾块可能降低占用率；本模型不模拟 tiling、核数和实际 padding，应降低有效效率并用同形状微基准校准。')
  } else if (x.operator === 'indexer') {
    for (const key of ['batch','queries','sequence','heads','dim','topk'] as const) integer(x[key],key)
    const { batch:b, queries:q, sequence:s, heads:h, dim:d, topk:t } = x
    if (t > s) throw new Error('Top-K 不能大于候选 Key 长度。')
    if (x.causal && q > s) throw new Error('右对齐 causal 模型要求 Query 长度不超过 Key 长度。')
    const pairs = b*(x.causal ? q*s-q*(q-1)/2 : q*s)
    w.cubeOps = 2*pairs*h*d
    w.vectorOps = 3*pairs*h // ReLU, multiply, sum; excludes transcendental throughput assumptions.
    w.comparisons = pairs*Math.log2(Math.max(2,t))
    const inputBytes = 2*(b*q*h*d + b*s*d + b*q*h), outputBytes = 4*b*q*t
    const scores = x.materialize ? 4*b*q*s : 0
    w.bytes = inputBytes+outputBytes+2*scores
    w.footprint = inputBytes+outputBytes+scores
    w.shapes = [`Q [${b}, ${q}, ${h}, ${d}]`, `K [${b}, ${s}, 1, ${d}]`, `W [${b}, ${q}, ${h}]`, `indices [${b}, ${q}, 1, ${t}] · INT32`]
    w.formulas = ['score = Σh W·ReLU(Q·Kᵀ)；候选数不因 Top-K 变小而减少。', `P = ${x.causal ? 'B·(Q·S − Q·(Q−1)/2)' : 'B·Q·S'}；Cube = 2·P·H·D；Vector ≈ 3·P·H。`, 'Top-K 成本代理 = P·log₂(max(2,K)) / 选择吞吐；不是 kernel 指令计数或严格下界。']
    w.warnings.push('Indexer 是打分与 Top-K 的算子范围，不是单独 QK kernel。选择吞吐为待校准假设，不能用 Cube TFLOPS 代替；未计分页查表、投影、通信及分块重读。')
    if (x.causal) w.warnings.push('Causal 仅按有效 pair 建模，假设跳过被 mask 的计算；实际 kernel 如仍计算完整 tile，耗时会更高。')
    if (d !== 128 || h > 64 || (t > 2048 && ![3072,4096,5120,6144,7168,8192].includes(t))) w.warnings.push('当前 shape 超出所引用 aclnnLightningIndexer 的部分接口约束；仅作算法情景估算，不表示接口可直接执行。')
  } else {
    integer(x.rows,'行数'); integer(x.width,'行宽')
    const {rows:r,width:d} = x
    w.shapes = [`X [${r}, ${d}]`]
    if (x.operator === 'gather') {
      integer(x.selected,'索引数')
      w.bytes = 4*x.selected*d + 4*x.selected
      w.footprint = 2*r*d + 2*x.selected*d + 4*x.selected
      w.shapes.push(`indices [${x.selected}] · INT32`, `Y [${x.selected}, ${d}]`)
      w.formulas = ['D = 2·Rselected·Dwidth·2 bytes + Rselected·4 bytes；按行 gather，允许重复索引。']
      w.warnings.push('随机访问按完整选中行读取；缓存命中、非连续地址、事务放大和索引越界不在此静态模型内。随机访问应降低内存效率。')
    } else {
      w.bytes = 4*r*d + (x.operator === 'rmsnorm' ? 2*d : 0)
      w.footprint = w.bytes
      w.vectorOps = x.operator === 'rmsnorm' ? 4*r*d+2*r : 5*r*d
      w.shapes.push(`Y [${r}, ${d}]`, ...(x.operator === 'rmsnorm' ? [`γ [${d}]`] : []))
      w.formulas = [x.operator === 'rmsnorm' ? 'Vector 基础运算 ≈ 4·R·D + 2·R；D = X + γ + Y。' : 'Vector 基础运算 ≈ 5·R·D；D = X + Y。', '归约、exp/rsqrt 延迟不等同于普通 ALU ops；有效 Vector 效率需要按算子校准。']
    }
  }
  for (const value of [w.cubeOps,w.vectorOps,w.bytes,w.footprint,w.comparisons]) {
    if (!Number.isFinite(value) || value > Number.MAX_SAFE_INTEGER) throw new Error('Shape 乘积超过安全计算范围，请缩小输入。')
  }
  return w
}
export function estimateRuntime(x: EstimateInput) {
  const w = workload(x)
  for (const key of ['bandwidth','capacity','trafficFactor'] as const) positive(x[key],key)
  if (w.cubeOps) positive(x.cube,'Cube 峰值')
  if (w.vectorOps) positive(x.vector,'Vector 峰值')
  if (w.comparisons) positive(x.selectionRate,'Top-K 选择吞吐')
  if (x.trafficFactor < 1) throw new Error('流量放大系数不能小于 1；本基线假设输入来自 HBM。')
  if (!Number.isFinite(x.overhead) || x.overhead < 0 || x.overhead > 1e6) throw new Error('设备固定开销必须在 0～1000000 µs 内。')
  for (const key of ['computeEfficiency','memoryEfficiency','vectorEfficiency'] as const) {
    positive(x[key], key, 1)
  }
  const cube = w.cubeOps ? w.cubeOps/(x.cube*1e6) : 0
  const vector = w.vectorOps ? w.vectorOps/(x.vector*1e6) : 0
  const memory = w.bytes*x.trafficFactor/(x.bandwidth*1e3)
  const selection = w.comparisons ? w.comparisons/(x.selectionRate*1e3) : 0
  const raw = [cube,vector,memory,selection]
  const efficiencies = [x.computeEfficiency,x.vectorEfficiency,x.memoryEfficiency,1]
  const typical = raw.map((v,i)=>v/efficiencies[i])
  // Indexer selection consumes Vector resources; don't overlap it with score-vector work.
  const overlap = (v:number[]) => Math.max(v[0],v[1]+v[3],v[2])
  const lower = overlap(raw.map((v,i)=>v/Math.min(1,efficiencies[i]*1.25)))+x.overhead
  const upper = raw.reduce((sum,v,i)=>sum+v/(efficiencies[i]*0.6),0)+x.overhead
  const central = overlap(typical)+x.overhead
  if (![cube,vector,memory,selection,lower,upper,central].every(Number.isFinite)) throw new Error('参数组合导致数值溢出，请调整吞吐或效率。')
  const bottlenecks = [ ['Cube 计算',typical[0]], ['Vector / Top-K',typical[1]+typical[3]], ['HBM 访存',typical[2]], ['固定开销',x.overhead] ] as const
  const bottleneck = [...bottlenecks].sort((a,b)=>b[1]-a[1])[0][0]
  const warnings = [...w.warnings]
  if (w.footprint > x.capacity*1e9) warnings.push('输入、输出及所选中间张量已超过该执行域的标称内存容量；当前 shape 不可按本基线一次驻留。时间仅是数学估算。')
  return { workload:w, lower, upper, central, resourceFloor:Math.max(cube,vector,w.bytes/(x.bandwidth*1e3)),
    parts:{cube:typical[0],vector:typical[1],memory:typical[2],selection}, bottleneck, warnings,
    fitsMemory:w.footprint <= x.capacity*1e9 }
}
export function compareMeasurement(result: ReturnType<typeof estimateRuntime>, measuredUs: number) {
  positive(measuredUs,'实测时间',1e12)
  const ratio = measuredUs/result.central
  const achievedCubeTops = result.workload.cubeOps/(measuredUs*1e6)
  const logicalBandwidth = result.workload.bytes/(measuredUs*1e3)
  if (![ratio,achievedCubeTops,logicalBandwidth].every(Number.isFinite)) throw new Error('实测时间过小，吞吐计算溢出；请检查时间单位。')
  const status = !result.fitsMemory ? 'capacity' : measuredUs < result.resourceFloor ? 'scope' : measuredUs > result.upper ? 'investigate' : measuredUs < result.lower ? 'faster' : 'within'
  const descriptions = {
    capacity: '先解决容量与分块口径，当前结果不适合判断性能异常。',
    scope: '低于当前 HBM 驻留假设下的资源下界：先检查单位、die 范围、缓存命中、shape 与 kernel 覆盖范围。',
    investigate: '高于当前情景区间：建议排查，不等同于确认性能缺陷。检查 tiling/尾块、重读、核利用率、同步与其他任务争用。',
    faster: '快于情景区间：当前效率假设可能偏保守，或存在缓存/融合收益；请先核对同一计算范围。',
    within: '落在当前假设区间内，不代表实现已最优；仍需同 shape 基准与流水线指标验证。',
  }
  return {ratio,status,description:descriptions[status],achievedCubeTops,logicalBandwidth}
}
