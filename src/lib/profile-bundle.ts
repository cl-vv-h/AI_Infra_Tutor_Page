import { importProfile, parseCsv, profileLimits, type TimeUnit } from './profile-import.ts'
import type { ProfileData, ProfileEvent } from './profile-analysis.ts'

export type ProfileFileKind = 'kernel' | 'trace' | 'tasks' | 'operators' | 'api' | 'framework' | 'steps' | 'unsupported'
export interface ProfileFileDescriptor { name: string; path?: string; size: number }
export interface ProfileBundleFile extends ProfileFileDescriptor { text?: string }
export interface ImportFileResult {
  name: string; kind: ProfileFileKind; status: 'read' | 'duplicate' | 'unsupported'
  bytes: number; rows?: number; retained?: number; rejected?: number; note: string
}
export interface ProfileSummaryRow {
  name: string; device: string; category: string; count?: number; total?: number
  mean?: number; min?: number; max?: number; hostSelf?: number; hostTotal?: number
  deviceSelf?: number; deviceTotal?: number; values?: Record<string, number>
}
export interface ProfileSummaryTable {
  kind: 'operators' | 'api' | 'framework' | 'steps'; rows: ProfileSummaryRow[]; rejected: number
}
export interface ProfileImportEvidence {
  files: ImportFileResult[]; joinedKernels: number; hardwareRecords: number
  kernelRecords: number; annotations: number; tables: ProfileSummaryTable[]
}
const basename = (s: string) => s.replace(/\\/g, '/').split('/').at(-1) ?? ''
export function profileFileKind(name: string): ProfileFileKind {
  const n = basename(name).toLowerCase()
  if (/^(kernel_details|op_summary)(?:_\d+)?\.csv$/.test(n)) return 'kernel'
  if (/^(trace_view|msprof(?:_\d+)?)\.json$/.test(n)) return 'trace'
  if (/^task_time(?:_\d+)?\.csv$/.test(n)) return 'tasks'
  if (/^op_statistic(?:_\d+)?\.csv$/.test(n)) return 'operators'
  if (/^api_statistic(?:_\d+)?\.csv$/.test(n)) return 'api'
  if (n === 'operator_details.csv') return 'framework'
  if (n === 'step_trace_time.csv') return 'steps'
  return 'unsupported'
}

/** Only plan reads here: logs, raw binary payloads and profiler metadata never enter memory. */
export function planProfileImport(files: ProfileFileDescriptor[]) {
  if (!files.length || files.length > 4096) throw new Error('请选择 1–4096 个文件；建议直接选择 ASCEND_PROFILER_OUTPUT 目录。')
  const hasFinal = files.some(f => /(?:^|\/)ASCEND_PROFILER_OUTPUT\//i.test((f.path ?? '').replace(/\\/g, '/')))
  const seen = new Set<ProfileFileKind>(), parents = new Set<string>()
  let bytes = 0
  const plan = files.map(f => {
    const path = (f.path ?? f.name).replace(/\\/g, '/'), kind = profileFileKind(f.name)
    const result: ImportFileResult = { name: basename(f.name), bytes: f.size, kind, status: 'read', note: '' }
    if (kind === 'unsupported') {
      result.status = 'unsupported'
      result.note = /\.db$/i.test(f.name) ? '数据库不直接解析；使用同目录已导出的 CSV / Trace。' : '原始二进制、日志或未支持文件不读取；需要 CANN 离线导出。'
    } else if (hasFinal && !/(?:^|\/)ASCEND_PROFILER_OUTPUT\//i.test(path)) {
      result.status = 'duplicate'; result.note = '优先使用最终输出目录，跳过中间导出的重复视图。'
    } else {
      parents.add(path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')
      if (seen.has(kind)) throw new Error('存在多个同类采样文件。每个 A/B 槽只导入一个采样目录，不自动合并不同 rank 或实验。')
      seen.add(kind)
      if (f.size > profileLimits.bytes) throw new Error('单文件上限 50 MiB，请裁剪采样或选择较小的导出文件。')
      bytes += f.size
    }
    return result
  })
  if (parents.size > 1) throw new Error('选择了不同输出目录；请每个槽只导入一份采样，避免混合未校时的数据。')
  if (bytes > 192 * 1024 * 1024) throw new Error('可解析文件总量超过 192 MiB，请缩小采样范围。')
  if (![...seen].some(k => k === 'kernel' || k === 'trace' || k === 'tasks')) throw new Error('未找到设备逐任务数据。请选择包含 kernel_details.csv、task_time.csv 或 trace_view.json 的输出目录。')
  return plan
}

const number = (s: string | undefined) => {
  if (!s?.trim() || /^(N\/?A|none|null|-)$/i.test(s.trim())) return undefined
  const v = Number(s)
  return Number.isFinite(v) && v >= 0 ? v : undefined
}
export function parseProfileSummary(text: string, kind: ProfileSummaryTable['kind']): ProfileSummaryTable {
  const [headers, ...raw] = parseCsv(text)
  if (!headers) throw new Error('汇总表为空。')
  const normalized = headers.map(h => h.trim().toLowerCase().replace(/[\s_]/g, '').replace(/[µμ]/g, 'u'))
  if (new Set(normalized).size !== normalized.length) throw new Error('汇总表列名重复。')
  const col = (...names: string[]) => normalized.findIndex(h => names.some(n => h === n.toLowerCase().replace(/[\s_]/g, '')))
  const name = col(kind === 'operators' ? 'OP Type' : kind === 'api' ? 'API Name' : kind === 'steps' ? 'Step' : 'Name')
  if (name < 0) throw new Error('汇总表缺少必需的名称 / Step 列。')
  const device = col('Device_id'), category = col('Core Type', 'Level'), count = col('Count')
  const total = col('Total Time(us)', 'Time(us)'), mean = col('Avg(us)', 'Avg Time(us)'), min = col('Min(us)', 'Min Time(us)'), max = col('Max(us)', 'Max Time(us)')
  const hostSelf = col('Host Self Duration(us)'), hostTotal = col('Host Total Duration(us)'), deviceSelf = col('Device Self Duration(us)'), deviceTotal = col('Device Total Duration(us)')
  const stepFields = ['Computing','Communication(Not Overlapped)','Overlapped','Communication','Free','Stage','Bubble','Communication(Not Overlapped and Exclude Receive)','Preparing']
  if ((kind === 'operators' || kind === 'api') && (total < 0 || count < 0)) throw new Error('算子/API 汇总需要次数与累计时间，不能用均值替代。')
  if (kind === 'framework' && hostSelf < 0) throw new Error('框架表缺少 Host Self Duration(us)。')
  if (kind === 'steps' && col('Computing') < 0) throw new Error('Step 表缺少 Computing 列。')
  const table: ProfileSummaryTable = { kind, rows: [], rejected: 0 }
  for (const row of raw) {
    const n = row[name]?.trim()
    if (row.length !== headers.length || (!n && kind !== 'steps') || ((kind === 'operators' || kind === 'api') && (number(row[count]) === undefined || number(row[total]) === undefined)) || (kind === 'framework' && number(row[hostSelf]) === undefined)) { table.rejected++; continue }
    const values = kind === 'steps' ? Object.fromEntries(stepFields.flatMap(key => { const n = number(row[col(key)]); return n === undefined ? [] : [[key, n]] })) : undefined
    if (kind === 'steps' && !Object.keys(values!).length) { table.rejected++; continue }
    // Deliberately omit Call Stack, paths and all unknown columns.
    table.rows.push({ name: n || '未标注 Step（采样汇总）', device: row[device]?.trim() ?? '', category: row[category]?.trim() ?? '', count: number(row[count]), total: number(row[total]), mean: number(row[mean]), min: number(row[min]), max: number(row[max]), hostSelf: number(row[hostSelf]), hostTotal: number(row[hostTotal]), deviceSelf: number(row[deviceSelf]), deviceTotal: number(row[deviceTotal]), values })
  }
  return table
}

/** A joined row needs matching task/physical stream, timestamps AND duration.
 * Task IDs alone repeat across graph replays. No filename-based clock inference.
 */
export function joinProfileTasks(kernel: ProfileData, trace: ProfileData) {
  const byId = new Map<string, number[]>()
  const id = (e: ProfileEvent) => e.taskId ? `${e.taskId}/${e.stream}` : ''
  trace.events.forEach((e, i) => { const key = id(e); if (key) { if (!byId.has(key)) byId.set(key, []); byId.get(key)!.push(i) } })
  const delta = (kernel.clockBaseUs ?? 0) - (trace.clockBaseUs ?? 0)
  const replacements = new Map<number, ProfileEvent>(), devices = new Map<string, string>()
  for (const event of kernel.events) {
    const candidates = (byId.get(id(event)) ?? []).filter(i => {
      const t = trace.events[i]
      return !replacements.has(i) && event.start !== undefined && t.start !== undefined
        && Math.abs(event.start + delta - t.start) <= .5 && Math.abs(event.duration - t.duration) <= .5
        && (!event.taskType || !t.taskType || event.taskType === t.taskType || (event.kind === 'copy' && t.kind === 'copy'))
    })
    if (candidates.length !== 1) throw new Error('Kernel 与 Trace 无法逐任务唯一对账。请确认来自同一次采样；可分别导入分析，不会静默拼接或重复计数。')
    const i = candidates[0], t = trace.events[i], mapped = devices.get(t.device)
    if (mapped && mapped !== event.device) throw new Error('一个 Trace 设备域匹配到多个 CSV 设备；请按设备分别导入。')
    devices.set(t.device, event.device)
    replacements.set(i, { ...t, ...event, start: t.start, duration: t.duration })
  }
  const events = trace.events.map((e, i) => replacements.get(i) ?? { ...e, device: devices.get(e.device) ?? e.device })
  return { ...trace, events, warnings: [...kernel.warnings, ...trace.warnings, '已按 Task ID、物理 Stream、开始时间与时长联合对账；设备时间线只保留一份，不累加重复 Kernel / Trace 记录。'], joined: replacements.size }
}

export function importProfileBundle(files: ProfileBundleFile[], unit: TimeUnit = 'auto'): ProfileData {
  const plan = planProfileImport(files), parsed = new Map<ProfileFileKind, ProfileData>()
  const evidence: ProfileImportEvidence = { files: plan, joinedKernels: 0, hardwareRecords: 0, kernelRecords: 0, annotations: 0, tables: [] }
  for (let i = 0; i < files.length; i++) {
    const report = plan[i]
    if (report.status !== 'read') continue
    const text = files[i].text
    if (text === undefined) throw new Error('文件读取未完成，请重新导入。')
    if (report.kind === 'kernel' || report.kind === 'trace' || report.kind === 'tasks') {
      const d = importProfile(text, unit)
      parsed.set(report.kind, d); report.retained = d.events.length; report.rejected = d.skipped; report.rows = d.events.length + d.skipped
      report.note = '设备记录已解析；时长有效但属于等待/控制的任务单列分析。'
    } else if (report.kind !== 'unsupported') {
      const table = parseProfileSummary(text, report.kind)
      evidence.tables.push(table); report.rows = table.rows.length + table.rejected; report.retained = table.rows.length; report.rejected = table.rejected
      report.note = '作为独立汇总证据，不生成设备调用，不与逐任务时长相加。'
    }
  }
  const kernel = parsed.get('kernel'), trace = parsed.get('trace'), tasks = parsed.get('tasks')
  let data = trace ?? tasks ?? kernel!
  if (kernel && (trace || tasks)) {
    const joined = joinProfileTasks(kernel, (trace ?? tasks)!)
    evidence.joinedKernels = joined.joined; data = joined
  }
  if (trace && tasks) {
    // Validate task_time against trace rather than accepting a second timeline.
    joinProfileTasks(tasks, trace)
    const report = plan.find(f => f.kind === 'tasks' && f.status === 'read')!
    report.status = 'duplicate'; report.note = '已与 Trace 逐任务对账；两份描述同一设备任务，保留 Trace 时间线一份。'
  }
  evidence.hardwareRecords = data.events.length
  evidence.kernelRecords = kernel?.events.length ?? 0
  evidence.annotations = data.annotations?.length ?? 0
  return { ...data, evidence }
}
