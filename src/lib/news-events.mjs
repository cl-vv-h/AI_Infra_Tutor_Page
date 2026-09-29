// Shared by the offline publisher (Node 20) and the reader. No network or storage.
export const EVENT_VERSION = 'news-events/1'
export const categoryNames = { ai: 'AI', technology: '科技', finance: '金融', world: '国际形势' }
export const kindNames = { fact: '已核对的公开记录', statement: '机构／当事方表态', analysis: '解读与判断' }
const fail = message => { throw new Error(`事件数据：${message}`) }
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const text = (value, max = 800) => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f\u007f<>]/u.test(value)
const id = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80
export const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
export const validTime = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && validDay(value.slice(0, 10)) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19)
const exact = (value, keys, label) => { if (!object(value) || Object.keys(value).some(key => !keys.includes(key))) fail(`${label} 包含未知字段或格式错误`) }
const array = (value, max, label, min = 0) => { if (!Array.isArray(value) || value.length < min || value.length > max) fail(`${label} 数量无效`) }
const unique = (values, label) => { if (new Set(values).size !== values.length) fail(`${label} 重复`) }
export function canonicalEventUrl(value) {
  try {
    if (typeof value !== 'string' || value.length > 2000 || /[\s\\]/u.test(value)) return null
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hostname === 'localhost' || !url.hostname.includes('.') || /^\d+(\.\d+){3}$/.test(url.hostname) || url.hostname.startsWith('[')) return null
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|cmpid$|ocid$|at_campaign$|at_medium$)/i.test(key)) url.searchParams.delete(key)
    url.searchParams.sort()
    if (url.hostname === 'news.un.org') url.pathname = url.pathname.replace(/^\/feed\/view\/en\/story\//, '/en/story/')
    return url.href
  } catch { return null }
}
const normalize = value => value.normalize('NFKC').toLowerCase().replace(/[\u2010-\u2015_]/g, ' ').replace(/\s+/g, ' ').trim()
// Rules are literal editor-authored terms, never executable regular expressions.
export function includesTerm(value, term) {
  const haystack = normalize(value), needle = normalize(term)
  let at = haystack.indexOf(needle)
  while (at >= 0) {
    const left = at === 0 || !/[a-z0-9]/.test(haystack[at - 1]) || !/^[a-z0-9]/.test(needle)
    const right = at + needle.length === haystack.length || !/[a-z0-9]/.test(haystack[at + needle.length]) || !/[a-z0-9]$/.test(needle)
    if (left && right) return true
    at = haystack.indexOf(needle, at + 1)
  }
  return false
}
export function validateCatalog(catalog) {
  exact(catalog, ['version', 'tracks'], '目录')
  if (catalog.version !== EVENT_VERSION) fail('不支持的目录版本')
  array(catalog.tracks, 30, '追踪主题')
  unique(catalog.tracks.map(track => track.id), '主题 ID')
  for (const track of catalog.tracks) {
    exact(track, ['id', 'category', 'title', 'summary', 'startDate', 'endDate', 'reviewedOn', 'openQuestions', 'learning', 'rules', 'milestones'], '主题')
    if (!id(track.id) || !Object.hasOwn(categoryNames, track.category) || !text(track.title, 100) || !text(track.summary, 400) || !validDay(track.startDate) || !validDay(track.reviewedOn) || (track.endDate && (!validDay(track.endDate) || track.endDate < track.startDate))) fail('主题元数据无效')
    array(track.openQuestions, 6, '待观察问题'); if (!track.openQuestions.every(question => text(question, 300))) fail('待观察问题无效')
    array(track.learning, 5, '延伸学习')
    for (const link of track.learning) {
      exact(link, ['label', 'path'], '学习链接')
      if (!text(link.label, 80) || typeof link.path !== 'string' || !/^\/(?:article|category|models)\/[a-z0-9-]+$/.test(link.path)) fail('学习链接无效')
    }
    array(track.rules, 12, '收录规则', 1); unique(track.rules.map(rule => rule.id), '规则 ID')
    for (const rule of track.rules) {
      exact(rule, ['id', 'label', 'hosts', 'pathPrefix', 'any', 'all', 'exclude'], '规则')
      if (!id(rule.id) || !text(rule.label, 150)) fail('规则元数据无效')
      array(rule.hosts, 25, '来源域名', 1)
      if (!rule.hosts.every(host => typeof host === 'string' && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) && !host.includes('..'))) fail('来源域名无效')
      if (rule.pathPrefix !== undefined && (typeof rule.pathPrefix !== 'string' || !/^\/[a-zA-Z0-9/._-]*$/.test(rule.pathPrefix))) fail('来源路径无效')
      for (const field of ['any', 'all', 'exclude']) { array(rule[field], 30, '匹配词'); if (!rule[field].every(term => text(term, 100))) fail('匹配词无效') }
      if (!rule.pathPrefix && !rule.any.length && !rule.all.length) fail('规则不得无条件收录整站')
    }
    array(track.milestones, 60, '关键节点'); unique(track.milestones.map(node => node.id), '节点 ID')
    for (const node of track.milestones) {
      exact(node, ['id', 'date', 'dateMeaning', 'title', 'kind', 'summary', 'context', 'sources'], '关键节点')
      if (!id(node.id) || !validDay(node.date) || node.date < track.startDate || (track.endDate && node.date > track.endDate) || !text(node.dateMeaning, 120) || !text(node.title, 120) || !Object.hasOwn(kindNames, node.kind) || !text(node.summary, 600) || !text(node.context, 500)) fail('关键节点无效')
      array(node.sources, 8, '节点来源', 1)
      for (const source of node.sources) {
        exact(source, ['url', 'title', 'publisher', 'publishedOn', 'reviewedOn', 'basis', 'scope'], '核对来源')
        if (!canonicalEventUrl(source.url) || !text(source.title, 250) || !text(source.publisher, 100) || !validDay(source.publishedOn) || !validDay(source.reviewedOn) || source.publishedOn > source.reviewedOn || source.reviewedOn > track.reviewedOn || !['document', 'publisher-summary'].includes(source.basis) || !text(source.scope, 250)) fail('核对来源无效')
      }
    }
  }
  return catalog
}
export function matchEventRules(track, item) {
  const url = canonicalEventUrl(item.url)
  if (!url || !text(item.title, 1000) || !validTime(item.publishedAt)) return []
  const day = item.publishedAt.slice(0, 10), parsed = new URL(url)
  if (day < track.startDate || (track.endDate && day > track.endDate)) return []
  return track.rules.filter(rule => rule.hosts.includes(parsed.hostname) && (!rule.pathPrefix || parsed.pathname.startsWith(rule.pathPrefix)) && (!rule.any.length || rule.any.some(term => includesTerm(item.title, term))) && rule.all.every(term => includesTerm(item.title, term)) && !rule.exclude.some(term => includesTerm(item.title, term))).map(rule => rule.id)
}
export function validateSnapshot(value) {
  exact(value, ['version', 'fingerprint', 'coverage', 'tracks'], '索引')
  if (value.version !== EVENT_VERSION || !/^[a-f0-9]{64}$/.test(value.fingerprint)) fail('索引版本或指纹无效')
  const c = value.coverage
  exact(c, ['dailyCollectedAt', 'releasesCollectedAt', 'libraryCollectedAt', 'archiveDates', 'missingArchiveDates', 'failedSources', 'invalidItems'], '覆盖范围')
  if (![c.dailyCollectedAt, c.releasesCollectedAt, c.libraryCollectedAt].every(validTime) || !Number.isSafeInteger(c.invalidItems) || c.invalidItems < 0) fail('采集元数据无效')
  for (const key of ['archiveDates', 'missingArchiveDates']) { array(c[key], 10000, '归档日期'); if (!c[key].every(validDay)) fail('归档日期无效'); unique(c[key], '归档日期') }
  array(c.failedSources, 200, '失败来源'); if (!c.failedSources.every(name => text(name, 120))) fail('失败来源无效')
  array(value.tracks, 30, '索引主题'); unique(value.tracks.map(track => track.id), '索引主题 ID')
  for (const track of value.tracks) {
    exact(track, ['id', 'reports'], '索引主题')
    if (!id(track.id)) fail('索引主题 ID 无效')
    array(track.reports, 10000, '关联报道'); unique(track.reports.map(report => report.url), '报道 URL')
    for (const report of track.reports) {
      exact(report, ['url', 'title', 'publisher', 'publisherCountry', 'publishedAt', 'firstCollectedAt', 'lastCollectedAt', 'ruleIds', 'revisionCount'], '关联报道')
      if (canonicalEventUrl(report.url) !== report.url || !text(report.title, 1000) || !text(report.publisher, 120) || !text(report.publisherCountry, 100) || ![report.publishedAt, report.firstCollectedAt, report.lastCollectedAt].every(validTime) || Date.parse(report.firstCollectedAt) > Date.parse(report.lastCollectedAt) || !Number.isSafeInteger(report.revisionCount) || report.revisionCount < 0) fail('关联报道无效')
      array(report.ruleIds, 12, '匹配规则', 1); if (!report.ruleIds.every(id)) fail('匹配规则无效')
    }
  }
  return value
}
export function sortedMilestones(track) { return [...track.milestones].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)) }
export function readEventQuery(params, tracks) {
  const event = params.get('event'), step = params.get('step'), source = params.get('source') || '', q = (params.get('q') || '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 160)
  const track = event ? tracks.find(track => track.id === event) : tracks[0]
  if (!track) return { error: event ? '这个追踪主题不存在或已撤下，未自动切换到其他主题。' : '暂无追踪主题。' }
  const milestones = sortedMilestones(track), index = step ? milestones.findIndex(node => node.id === step) : Math.max(0, milestones.length - 1)
  if (index < 0) return { error: '这个关键节点不存在或已修订，请重新选择节点。', track }
  return { track, index, source: source.slice(0, 120), q }
}
export function eventQuery({ event, step, source = '', q = '' }) {
  const params = new URLSearchParams(); if (event) params.set('event', event); if (step) params.set('step', step); if (source) params.set('source', source); if (q) params.set('q', q)
  return params
}
export function filteredReports(reports, { source = '', q = '' } = {}) {
  const terms = normalize(q).split(' ').filter(Boolean)
  return reports.filter(report => (!source || report.publisher === source) && terms.every(term => normalize(`${report.title} ${report.publisher}`).includes(term))).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.url.localeCompare(b.url))
}
export function freshnessLabel(iso, now = Date.now(), days = 3) {
  if (!validTime(iso) || !Number.isFinite(now)) return '时间未知'
  const age = now - Date.parse(iso)
  if (age < -3600000) return '采集时间在未来，请核对时钟'
  return age > days * 86400000 ? `采集已超过 ${days} 天，可能遗漏后续` : '采集窗口内（不代表事件完整）'
}
const md = value => value.replace(/[\\`*_{}\[\]()#+!|]/g, '\\$&')
export function eventMarkdown(track, reports, coverage) {
  const lines = [`# ${md(track.title)}`, '', md(track.summary), '', `人工核对截至：${track.reviewedOn}。每日采集：${coverage.dailyCollectedAt}；版本采集：${coverage.releasesCollectedAt}。`, '', '关键节点与规则关联报道分开；不保证覆盖完整，不构成投资建议。', '']
  for (const node of sortedMilestones(track)) {
    lines.push(`## ${node.date} · ${md(node.title)}`, '', `${kindNames[node.kind]}；日期含义：${md(node.dateMeaning)}`, '', md(node.summary), '', `阅读提示：${md(node.context)}`, '')
    for (const source of node.sources) lines.push(`- [${md(source.title)}](<${canonicalEventUrl(source.url)}>) — ${md(source.publisher)}；发布 ${source.publishedOn}，核对 ${source.reviewedOn}；${source.basis === 'document' ? '原始文档' : '发布方摘要'}。${md(source.scope)}`)
    lines.push('')
  }
  lines.push('## 尚待观察', '', ...track.openQuestions.map(question => `- ${md(question)}`), '', '## 规则关联报道（未逐条核对，不是独立证实）', '')
  for (const report of filteredReports(reports)) lines.push(`- ${report.publishedAt} [${md(report.title)}](<${report.url}>) — ${md(report.publisher)}；首次收录 ${report.firstCollectedAt}，最近收录 ${report.lastCollectedAt}`)
  return `${lines.join('\n')}\n`
}
