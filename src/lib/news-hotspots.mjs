import { canonicalEventUrl, includesTerm, validTime } from './news-events.mjs'

export const HOTSPOT_VERSION = 'news-hotspots/1'
export const categories = { ai: 'AI', technology: '科技', finance: '金融', world: '国际' }
const hour = 3600000
// Ordered, literal, inspectable topic rules. These group subjects, NOT verified events.
const topic = (id, title, category, any, all = [], sources = []) => ({ id, title, category, any, all, sources })
export const hotspotTopics = [
  topic('openai-safety', 'OpenAI：模型安全与发布进展', 'ai', ['safety', 'safe', 'scraps', 'shelves', 'halt', 'misalignment'], ['openai', 'chatgpt']),
  topic('agent-security', 'AI Agent：安全与运行时控制', 'ai', ['safety', 'security', 'secure', 'openshell', 'control'], ['agent', 'agents', 'agentic']),
  topic('ai-chip-trade', 'AI 芯片：贸易与出口限制', 'technology', ['china', 'chinese', 'export', 'sanctions'], ['nvidia', 'chip', 'chips', 'semiconductor', 'semiconductors']),
  topic('ai-regulation', 'AI 与平台监管', 'ai', ['regulation', 'regulatory', 'antitrust', 'eu orders', 'competition', 'copyright', 'lawsuit'], ['ai', 'google', 'openai', 'meta', 'artificial intelligence']),
  topic('ai-financing', 'AI 产业：融资与投资', 'finance', ['funding', 'raises', 'valuation', 'investors', 'investment', 'financing'], ['ai', 'openai', 'anthropic', 'modal', 'artificial intelligence']),
  topic('sglang', 'SGLang：推理框架进展', 'ai', ['sglang'], [], ['SGLang Releases']),
  topic('vllm', 'vLLM：推理框架进展', 'ai', ['vllm'], [], ['vLLM Releases', 'vLLM Blog']),
  topic('openai', 'OpenAI：产品与研究', 'ai', ['openai', 'chatgpt']),
  topic('anthropic', 'Anthropic 与 Claude', 'ai', ['anthropic', 'claude']),
  topic('google-models', 'Google：Gemini 与 DeepMind', 'ai', ['gemini', 'deepmind']),
  topic('open-models', '开放模型与工具生态', 'ai', ['hugging face', 'holo4', 'qwen', 'llama', 'deepseek', 'mistral']),
  topic('cloudflare', 'Cloudflare：开发者平台', 'technology', ['cloudflare', 'vinext', 'emdash'], [], ['Cloudflare Engineering']),
  topic('space', '航天任务与探索', 'technology', ['artemis', 'spacex', 'nasa', 'space station', 'rocket', 'lunar']),
  topic('fed', '美联储：政策与经济信号', 'finance', ['federal reserve', 'fed rate', 'fomc'], [], ['U.S. Federal Reserve']),
  topic('ecb', '欧洲央行：政策与经济信号', 'finance', ['european central bank', 'ecb', 'lagarde'], [], ['European Central Bank']),
  topic('boj', '日本央行：政策与经济信号', 'finance', ['bank of japan', 'boj'], [], ['Bank of Japan']),
  topic('boe', '英国央行：政策与经济信号', 'finance', ['bank of england'], [], ['Bank of England']),
  topic('rba', '澳大利亚央行：政策与经济信号', 'finance', ['reserve bank of australia', 'rba', 'australia raises interest rates', 'australia cuts interest rates'], [], ['Reserve Bank of Australia']),
  topic('energy', '能源价格与供应', 'finance', ['oil prices', 'fuel prices', 'energy prices', 'crude', 'opec', 'electricity grid']),
  topic('uk-airbase', '英国空军基地：安全事件报道', 'world', ['airbase', 'air base'], ['uk', 'british', 'britain', 'raf']),
  topic('ukraine', '俄乌局势', 'world', ['ukraine', 'ukrainian', 'kyiv', 'zelensky', 'zelenskyy']),
  topic('israel-palestine', '以巴局势', 'world', ['gaza', 'west bank', 'palestinian', 'palestinians', 'hamas', 'israeli', 'israel']),
  topic('iran', '伊朗与地区局势', 'world', ['iran', 'iranian', 'tehran']),
  topic('south-sudan', '南苏丹：政治与人道局势', 'world', ['south sudan', 'south sudanese']),
  topic('sudan', '苏丹冲突与人道局势', 'world', ['sudan', 'darfur', 'khartoum']),
  topic('ethiopia', '埃塞俄比亚：冲突与地区动态', 'world', ['ethiopia', 'ethiopian', 'tigray', 'alamata']),
  topic('brazil-election', '巴西：选举与政治动态', 'world', ['brazil', 'brazilian', 'lula', 'bolsonaro']),
  topic('un-general-assembly', '联合国大会与国际议程', 'world', ['general assembly', 'unga', 'un debate']),
  topic('climate', '气候与极端天气', 'world', ['flood', 'flooding', 'floods', 'hurricane', 'typhoon', 'climate change', 'wildfire']),
]

export function matchTopic(item) {
  return hotspotTopics.find(rule => rule.sources.includes(item.source) ||
    (rule.any.some(term => includesTerm(item.title, term)) && (!rule.all.length || rule.all.some(term => includesTerm(item.title, term)))))
}
export function publisherFamily(name) {
  if (name.startsWith('BBC ')) return 'BBC'
  if (name.startsWith('NVIDIA ') || name === 'TensorRT-LLM Releases') return 'NVIDIA'
  if (['Google Research', 'DeepMind'].includes(name)) return 'Google'
  if (name.startsWith('vLLM ')) return 'vLLM'
  if (name.startsWith('FlashInfer ')) return 'FlashInfer'
  if (['Hugging Face Blog', 'Transformers Releases'].includes(name)) return 'Hugging Face'
  return name
}
export function hotspotUrl(value) {
  const canonical = canonicalEventUrl(value)
  if (!canonical) return null
  const url = new URL(canonical)
  for (const key of [...url.searchParams.keys()]) if (/^(maca|traffic_source|at_campaign|at_medium)$/i.test(key)) url.searchParams.delete(key)
  return url.toString().replace(/\/$/, '')
}
export const headlineKey = title => title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const textOk = (s, max) => typeof s === 'string' && s.length > 0 && s.length <= max && !/[\u0000-\u001f]/.test(s)

export function validateHotspotCorpus(data) {
  if (!data || data.version !== HOTSPOT_VERSION || !validTime(data.generatedAt) || !validTime(data.startedAt) || data.startedAt > data.generatedAt || !Array.isArray(data.items) || data.items.length > 20000 || !Array.isArray(data.sources) || data.sources.length > 200) throw new Error('热点数据格式或版本无效')
  const urls = new Set(), ids = new Set(), names = new Set()
  for (const row of data.items) {
    if (!row || !/^[a-f0-9]{16}$/.test(row.id) || ids.has(row.id) || !textOk(row.title, 240) || !textOk(row.source, 120) || !textOk(row.country, 120) || !Object.hasOwn(categories, row.category) || hotspotUrl(row.url) !== row.url || urls.has(row.url) || !validTime(row.publishedAt) || !validTime(row.firstSeenAt) || !validTime(row.lastSeenAt) || row.firstSeenAt > row.lastSeenAt || row.lastSeenAt > data.generatedAt || Date.parse(row.publishedAt) > Date.parse(data.generatedAt) + hour) throw new Error('热点报道记录无效')
    urls.add(row.url); ids.add(row.id)
  }
  for (const source of data.sources) {
    if (!source || !textOk(source.name, 120) || names.has(source.name) || !textOk(source.country, 120) || !['ok', 'unavailable', 'invalid'].includes(source.state) || !Number.isInteger(source.count) || source.count < 0 || !hotspotUrl(source.url)) throw new Error('热点来源状态无效')
    names.add(source.name)
  }
  return data
}

export function windowReports(items, asOf, hours) {
  if (!validTime(asOf) || ![24, 72, 168, 720].includes(hours)) throw new Error('热点时间窗口无效')
  const end = Date.parse(asOf)
  return items.filter(item => Date.parse(item.publishedAt) <= end && Date.parse(item.publishedAt) > end - hours * hour)
}

export function heatScore(reports, asOf) {
  // One identical headline credit across publishers; repeated feed variants cannot inflate activity.
  const headlines = new Set(), families = new Map()
  for (const report of [...reports].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.url.localeCompare(b.url))) {
    const title = headlineKey(report.title)
    if (headlines.has(title)) continue
    headlines.add(title)
    const family = publisherFamily(report.source)
    const age = Math.max(0, (Date.parse(asOf) - Date.parse(report.publishedAt)) / hour)
    const values = families.get(family) || []
    values.push(2 ** (-age / 24)); families.set(family, values)
  }
  const activity = [...families.values()].reduce((sum, values) => sum + values.slice(0, 3).reduce((a, b) => a + b, 0), 0)
  return { score: Math.round(activity * 10 * 10) / 10, creditedHeadlines: headlines.size, publishers: new Set(reports.map(row => publisherFamily(row.source))).size }
}

export function buildHotspots(corpus, hours = 72) {
  const groups = new Map(), clusters = []
  // Cluster the whole retained corpus first so a time-window change does not rename a cluster.
  const retained = windowReports(corpus.items, corpus.generatedAt, 720).sort((a,b)=>a.firstSeenAt.localeCompare(b.firstSeenAt)||a.id.localeCompare(b.id))
  for (const row of retained) {
    const rule = matchTopic(row)
    const words = headlineWords(row.title)
    // Match a seed, not a chain of loosely related headlines. Never merge on one entity alone.
    const near = rule ? undefined : clusters.find(cluster => cluster.category===row.category && similarHeadline(words, cluster.words))
    const id = rule?.id || near?.id || `story-${row.id}`
    if (!groups.has(id)) { groups.set(id, { id, title: rule?.title || row.title, category: rule?.category || row.category, kind: rule ? 'topic' : 'story', reports: [] }); if(!rule) clusters.push({id,words,category:row.category}) }
    groups.get(id).reports.push(row)
  }
  return [...groups.values()].map(group => ({...group,reports:windowReports(group.reports,corpus.generatedAt,hours)})).filter(group=>group.reports.length).map(group => {
    group.reports.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.url.localeCompare(b.url))
    if(group.kind==='story' && group.reports.length>1) group.kind='cluster'
    if(group.kind!=='topic') group.title=group.reports[0].title
    return { ...group, ...heatScore(group.reports, corpus.generatedAt), latestAt: group.reports[0].publishedAt }
  }).sort((a, b) => b.score - a.score || b.latestAt.localeCompare(a.latestAt) || a.id.localeCompare(b.id))
}

const stopWords = new Set('a an the and or for of on in to at by with from over amid after before as is are be been being was were has have had will would could should can may might its it new says say said more most about into up out their this that these those us uk'.split(' '))
export const headlineWords = title => new Set(headlineKey(title).split(' ').filter(word=>word.length>=3&&!stopWords.has(word)))
export function similarHeadline(left,right) {
  const intersection = [...left].filter(word=>right.has(word)).length
  return intersection>=3 && intersection / Math.max(left.size,right.size)>=0.6
}

export function distribution(items, asOf) {
  const counts = Object.fromEntries(Object.keys(categories).map(key => [key, 0])), countries = new Map()
  for (const item of items) {
    counts[matchTopic(item)?.category || item.category]++
    countries.set(item.country, (countries.get(item.country) || 0) + 1)
  }
  const endDay = Date.parse(`${asOf.slice(0, 10)}T00:00:00Z`)
  const days = Array.from({ length: 7 }, (_, i) => new Date(endDay - (6 - i) * 24 * hour).toISOString().slice(0, 10))
  const matrix = Object.fromEntries(Object.keys(categories).map(key => [key, days.map(day => items.filter(row => row.publishedAt.startsWith(day) && (matchTopic(row)?.category || row.category) === key).length)]))
  return { counts, countries: [...countries].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])), days, matrix }
}

export const FOLLOW_KEY = 'ai-infra-hotspot-follows-v1'
export function parseFollows(raw) {
  if (raw === null) return { version: 1, entries: [] }
  const value = JSON.parse(raw)
  const ids = new Set()
  if (value?.version !== 1 || !Array.isArray(value.entries) || value.entries.length > 50) throw new Error('关注记录格式或版本不受支持，原数据未被覆盖')
  for (const row of value.entries) {
    if (!row || !/^[a-z0-9-]{1,80}$/.test(row.id) || ids.has(row.id) || !textOk(row.title, 240) || !validTime(row.seenThrough)) throw new Error('关注记录损坏，原数据未被覆盖')
    ids.add(row.id)
  }
  return value
}
// Read-modify-write under an exclusive cross-tab Web Lock; reject unavailable locking, never pretend success.
export async function changeFollow(storage, locks, id, title, asOf, action) {
  if (!locks?.request) throw new Error('当前浏览器不支持安全写入关注记录；请使用支持 Web Locks 的浏览器')
  return locks.request(FOLLOW_KEY, async () => {
    const value = parseFollows(storage.getItem(FOLLOW_KEY))
    const found = value.entries.find(row => row.id === id)
    if (action === 'remove') value.entries = value.entries.filter(row => row.id !== id)
    else if (action === 'read') { if (found && Date.parse(asOf)>Date.parse(found.seenThrough)) found.seenThrough = asOf }
    else if (action === 'add' && !found) {
      if (value.entries.length >= 50) throw new Error('最多关注 50 个主题，请先取消部分关注')
      value.entries.push({ id, title, seenThrough: asOf })
    } else if (action !== 'add') throw new Error('无效关注操作')
    const raw = JSON.stringify(value)
    parseFollows(raw)
    storage.setItem(FOLLOW_KEY, raw)
    if (storage.getItem(FOLLOW_KEY) !== raw) throw new Error('关注记录写入未通过校验，请刷新核对')
    return value
  })
}
