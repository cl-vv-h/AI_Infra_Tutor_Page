import { readdir, readFile } from 'node:fs/promises'

const archiveRoot = new URL('../src/data/news/archive/', import.meta.url)
const reportPath = new URL('../src/data/news/weekly/latest.json', import.meta.url)
const requiredSections = ['# 本周信号', '## AI', '## 科技', '## 金融', '## 国际形势', '## 跨板块观察', '## 下周观察清单']
const forbiddenPatterns = [
  /OPENAI_API_KEY/i,
  /\bsk-[A-Za-z0-9_-]{12,}\b/,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /(?:\/Users\/|\/home\/|[A-Z]:\\Users\\)/i,
]

const fail = (message) => {
  console.error(`Weekly report validation failed: ${message}`)
  process.exit(1)
}

let archiveFiles
try {
  archiveFiles = (await readdir(archiveRoot))
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .sort()
    .slice(-7)
} catch {
  fail('no daily news archive is available')
}

if (!archiveFiles.length) fail('no daily news archive is available')

let report
try {
  report = JSON.parse(await readFile(reportPath, 'utf8'))
} catch {
  fail('latest.json is missing or is not valid JSON')
}

const archives = await Promise.all(
  archiveFiles.map(async (name) => JSON.parse(await readFile(new URL(name, archiveRoot), 'utf8'))),
)
const archiveUrls = new Set(archives.flatMap((archive) => archive.items ?? []).map((item) => item.url))
const expectedStart = archiveFiles[0].replace('.json', '')
const expectedEnd = archiveFiles.at(-1).replace('.json', '')

if (report.model !== 'gpt-5.6-luna') fail('model must be gpt-5.6-luna')
if (report.periodStart !== expectedStart || report.periodEnd !== expectedEnd) {
  fail(`period must cover the latest archive window (${expectedStart} to ${expectedEnd})`)
}
if (!report.generatedAt || Number.isNaN(Date.parse(report.generatedAt))) fail('generatedAt must be an ISO timestamp')
if (!Number.isInteger(report.itemCount) || report.itemCount < 1) fail('itemCount must be a positive integer')
if (typeof report.content !== 'string' || report.content.length < 200) fail('content is unexpectedly short')
if (report.content.length > 12000) fail('content is unexpectedly long')

for (const section of requiredSections) {
  if (!report.content.includes(section)) fail(`missing section: ${section}`)
}
for (const pattern of forbiddenPatterns) {
  if (pattern.test(JSON.stringify(report))) fail(`sensitive or local-only data matched ${pattern}`)
}

if (!Array.isArray(report.sources) || !report.sources.length) fail('sources must contain cited public news items')
const sourceUrls = new Set()
for (const source of report.sources) {
  if (!source || typeof source.title !== 'string' || typeof source.source !== 'string') fail('a source entry is malformed')
  if (typeof source.url !== 'string' || !/^https:\/\//.test(source.url)) fail('all source URLs must use HTTPS')
  if (!archiveUrls.has(source.url)) fail(`source URL is absent from the archive: ${source.url}`)
  if (sourceUrls.has(source.url)) fail(`duplicate source URL: ${source.url}`)
  sourceUrls.add(source.url)
}

const contentUrls = [...report.content.matchAll(/https:\/\/[^\s)\]]+/g)].map(([url]) => url.replace(/[.,;!?，。；！？]+$/, ''))
for (const url of contentUrls) {
  if (!sourceUrls.has(url)) fail(`content cites a URL not declared in sources: ${url}`)
}

console.log(`Weekly report is valid: ${report.periodStart}–${report.periodEnd}, ${report.sources.length} cited sources.`)
