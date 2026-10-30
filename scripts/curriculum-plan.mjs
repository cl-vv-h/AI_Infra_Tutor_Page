import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as plan from '../docs/curriculum/plan.mjs'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const repository = 'https://github.com/cl-vv-h/SGLang_Tutor'
const sha256 = value => createHash('sha256').update(value).digest('hex')
const materialPattern = /^learning\/(zh|en)\/(.+\.(?:md|py|html))$/
const fail = message => { throw new Error(message) }
const idFor = path => `material-${sha256(path).slice(0, 16)}`
const layers = { overview: '总览', principles: '原理', runtime: '运行时', platform: '平台实现', experiment: '实验', reference: '参考', 'case-study': '综合案例', visualization: '交互图' }
const difficulties = { introductory: '入门', intermediate: '进阶', advanced: '深入' }
const roles = { lesson: '正文', navigation: '目录', experiment: '实验代码', 'annotated-source': '注释源码', reference: '参考资料', 'case-study': '模型案例', visualization: '图表资源', maintenance: '维护资料', license: '许可证', 'resource-index': '资源索引' }
const actionLabels = { 'split-service-and-expert-routing': '分开服务路由与专家路由', 'split-by-learning-objective': '按学习目标拆章', 'translation-en-missing': '待补英文', 'repair-demo-paths': '修正示例路径', 'document-run-contract-before-publishing': '核对实验依赖、命令与预期输出' }
const copyLabels = { missing: '未收录', different: '内容不同，待对照', identical: '一致' }

export function assertSafePath(path) {
  if (typeof path !== 'string' || !path || /[\\\x00-\x1f?#]/.test(path) || /^(?:\/|[a-z]:)/i.test(path) || path.split('/').some(segment => !segment || segment === '.' || segment === '..')) fail(`Unsafe source path: ${path}`)
}

export function assertAcyclicTopics(topics) {
  const map = new Map(topics.map(topic => [topic.id, topic]))
  if (map.size !== topics.length) fail('Duplicate topic ID')
  const done = new Set(), active = new Set()
  function visit(id) {
    if (!map.has(id)) fail(`Unknown prerequisite topic: ${id}`)
    if (active.has(id)) fail(`Cyclic topic prerequisite: ${id}`)
    if (done.has(id)) return
    active.add(id)
    for (const prerequisite of map.get(id).prerequisites) visit(prerequisite)
    active.delete(id)
    done.add(id)
  }
  for (const id of map.keys()) visit(id)
}

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

// Read committed objects, not working-tree files; never copy uncommitted edits.
export function readSnapshot(root, revision, path) {
  const resolved = git(root, ['rev-parse', '--verify', `${revision}^{commit}`]).trim()
  if (resolved !== revision) fail('Snapshot must be a full, fixed commit SHA')
  const entries = git(root, ['ls-tree', '-rz', revision, '--', path]).split('\0').filter(Boolean).map(line => {
    const match = line.match(/^(\d+) (\w+) ([0-9a-f]+)\t(.+)$/)
    if (!match || match[2] !== 'blob' || !['100644', '100755'].includes(match[1])) fail('Unsupported snapshot object')
    assertSafePath(match[4])
    return { path: match[4], gitBlob: match[3] }
  })
  return { entries, read: path => git(root, ['show', `${revision}:${path}`]) }
}

export function extractVersions(content) {
  const versions = new Map()
  const pattern = /https:\/\/(github\.com|huggingface\.co)\/([\w.-]+\/[\w.-]+)\/(?:blob|tree|commit|resolve)\/([a-f0-9]{7,40})(?=[/#)\s]|$)[^\s)<>"`]*/gi
  for (const match of content.matchAll(pattern)) {
    const key = `${match[1]}/${match[2]}@${match[3]}`
    if (!versions.has(key)) versions.set(key, { repository: `https://${match[1]}/${match[2]}`, revision: match[3], evidenceUrl: match[0] })
  }
  return [...versions.values()]
}

function titleFor(path, content) {
  const override = Object.entries(plan.titleOverrides).find(([suffix]) => path.endsWith(suffix))?.[1]
  if (override) return override
  const title = path.endsWith('.html') ? content.match(/<title>(.*?)<\/title>/s)?.[1] : content.match(/^#\s+(.+)$/m)?.[1]
  if (!title) fail(`Missing reviewed title: ${path}`)
  return title.replace(/[`*]/g, '').trim()
}

function roleFor(assignment) {
  const path = assignment.sourcePath
  if (path.endsWith('.html')) return 'visualization'
  if (path.endsWith('.py')) return path.includes('-annotated-cn.py') ? 'annotated-source' : 'experiment'
  if (assignment.layer === 'case-study') return 'case-study'
  const fullLessonReadmes = ['Inference_Basics', 'KV_Cache_Memory', 'KV_Transfer', 'Benchmark_Profiling']
  if (path.endsWith('README.md') && !fullLessonReadmes.some(folder => path.endsWith(`${folder}/README.md`))) return 'navigation'
  return assignment.layer === 'reference' ? 'reference' : 'lesson'
}

export function buildCatalog(source, site) {
  const inventory = source.entries
  const localized = new Map()
  for (const entry of inventory) {
    const match = entry.path.match(materialPattern)
    if (!match) continue
    const [, language, path] = match
    const translations = localized.get(path) ?? {}
    translations[language] = entry
    localized.set(path, translations)
  }
  const assignmentMap = new Map(plan.assignments.map(entry => [entry.sourcePath, entry]))
  if (assignmentMap.size !== plan.assignments.length) fail('Duplicate editorial assignment')
  for (const path of localized.keys()) if (!assignmentMap.has(path)) fail(`Unclassified material: ${path}`)
  for (const path of assignmentMap.keys()) if (!localized.has(path)) fail(`Assigned file absent from source: ${path}`)
  for (const path of Object.keys(plan.editorialOverrides)) if (!assignmentMap.has(path)) fail(`Orphan editorial override: ${path}`)
  const siteIndex = JSON.parse(site.read('src/data/curriculum-index.json'))
  const siteEntries = new Map(site.entries.map(entry => [entry.path, entry]))
  const topicMap = new Map(plan.topics.map(topic => [topic.id, topic]))
  const materials = [...localized].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([path, translations]) => {
    const assignment = assignmentMap.get(path)
    const override = plan.editorialOverrides[path] ?? {}
    const topic = topicMap.get(assignment.topicId)
    const article = siteIndex.find(entry => entry.sourcePath === path)
    const primary = translations.zh ?? translations.en
    const body = source.read(primary.path)
    const lineCount = body.split('\n').length
    const role = override.role ?? roleFor(assignment)
    const sourceFiles = Object.fromEntries(Object.entries(translations).map(([language, entry]) => {
      const siteFile = siteEntries.get(`src/data/content/${language}/${path}`)
      return [language, {
        path: entry.path, gitBlob: entry.gitBlob,
        url: `${repository}/blob/${plan.sourceRevision}/${entry.path}`,
        siteCopy: !siteFile ? 'missing' : siteFile.gitBlob === entry.gitBlob ? 'identical' : 'different',
      }]
    }))
    const actions = [...(override.actions ?? [])]
    if (lineCount >= 1500 && path.endsWith('.md') && !['navigation', 'license', 'maintenance'].includes(role)) actions.push('split-by-learning-objective')
    if (!translations.en) actions.push('translation-en-missing')
    if (role === 'experiment') actions.push('document-run-contract-before-publishing')
    const versions = extractVersions(body)
    return {
      id: idFor(path), sourcePath: path, title: titleFor(path, body),
      domainId: topic.domainId, topicId: topic.id, role,
      layer: override.layer ?? assignment.layer, difficulty: assignment.difficulty,
      platformScope: assignment.platformScope,
      prerequisites: override.prerequisites ?? topic.prerequisites,
      relatedTopics: override.relatedTopics ?? [],
      status: 'source-present', availableLanguages: Object.keys(translations).sort(), sources: sourceFiles,
      primaryLineCount: lineCount,
      versionEvidence: { status: versions.length ? 'pinned-links-found-needs-review' : 'no-direct-pinned-link-found', references: versions },
      verification: 'catalog-only-no-execution',
      existingSiteRoute: article ? `#/article/${article.slug}` : null,
      actions: [...new Set(actions)], notes: [...(override.notes ?? []), ...(role === 'annotated-source' ? ['英文目录中的该文件仍是中文注释源码；语言文件存在不代表正文已翻译。'] : [])],
    }
  })
  const record = {
    schemaVersion: 1, auditedAt: plan.auditedAt, repository, sourceRevision: plan.sourceRevision, siteRevision: plan.siteRevision,
    scope: 'editorial-catalog-only', domains: plan.domains, topics: plan.topics,
    materials, planned: plan.planned.map(item => ({ ...item, evidenceUrl: `${repository}/blob/${plan.sourceRevision}/learning/zh/${item.evidencePath}`, relatedExistingMaterialIds: materials.filter(material => material.topicId === item.topicId && ['lesson', 'case-study'].includes(material.role)).map(material => material.id) })),
    learningPaths: plan.learningPaths,
    existingSiteOnly: siteIndex.filter(article => !localized.has(article.sourcePath)).map(({ sourcePath, slug }) => ({ sourcePath, route: `#/article/${slug}` })),
    inventory: inventory.map(entry => ({ ...entry, kind: materialPattern.test(entry.path) ? 'localized-material' : /^learning\/(zh|en)\//.test(entry.path) ? 'resource' : 'maintenance' })),
  }
  validateCatalog(record)
  return record
}

export function validateCatalog(catalog) {
  if (catalog.schemaVersion !== 1 || catalog.scope !== 'editorial-catalog-only' || catalog.repository !== repository) fail('Unsupported catalog schema, repository or scope')
  for (const revision of [catalog.sourceRevision, catalog.siteRevision]) if (!/^[a-f0-9]{40}$/.test(revision)) fail('Unpinned repository revision')
  if (catalog.domains.length !== 8 || new Set(catalog.domains.map(item => item.id)).size !== 8) fail('Expected eight unique domains')
  assertAcyclicTopics(catalog.topics)
  const domains = new Set(catalog.domains.map(item => item.id)), topics = new Map(catalog.topics.map(item => [item.id, item]))
  for (const topic of topics.values()) if (!domains.has(topic.domainId)) fail(`Unknown topic domain: ${topic.id}`)
  const inventory = new Map(catalog.inventory.map(item => [item.path, item]))
  if (inventory.size !== catalog.inventory.length) fail('Duplicate inventory path')
  const materials = new Map(catalog.materials.map(item => [item.sourcePath, item]))
  if (materials.size !== catalog.materials.length || new Set(catalog.materials.map(item => item.id)).size !== materials.size) fail('Duplicate material path or ID')
  for (const item of catalog.inventory) {
    assertSafePath(item.path)
    if (!/^[a-f0-9]{40}$/.test(item.gitBlob)) fail('Invalid source blob')
    const kind = materialPattern.test(item.path) ? 'localized-material' : /^learning\/(zh|en)\//.test(item.path) ? 'resource' : 'maintenance'
    if (item.kind !== kind) fail('Incorrect inventory classification')
  }
  const consumed = new Set()
  for (const item of materials.values()) {
    assertSafePath(item.sourcePath)
    if (item.id !== idFor(item.sourcePath)) fail('Unstable material ID')
    if (!topics.has(item.topicId) || item.domainId !== topics.get(item.topicId).domainId) fail(`Invalid topic/domain: ${item.sourcePath}`)
    if (!layers[item.layer] || !roles[item.role] || !difficulties[item.difficulty]) fail('Invalid material classification')
    if (item.status !== 'source-present' || item.verification !== 'catalog-only-no-execution') fail('Unjustified completion or execution claim')
    if (!Number.isInteger(item.primaryLineCount) || item.primaryLineCount < 1) fail('Invalid material line count')
    for (const id of [...item.prerequisites, ...item.relatedTopics]) if (!topics.has(id)) fail(`Unknown material topic dependency: ${id}`)
    if (item.prerequisites.includes(item.topicId)) fail(`Self prerequisite: ${item.sourcePath}`)
    if (!item.availableLanguages.length || JSON.stringify([...item.availableLanguages].sort()) !== JSON.stringify(Object.keys(item.sources).sort())) fail('False translation availability')
    for (const [language, source] of Object.entries(item.sources)) {
      if (!['zh', 'en'].includes(language) || source.path !== `learning/${language}/${item.sourcePath}`) fail('Invalid translation path')
      if (!inventory.has(source.path) || inventory.get(source.path).gitBlob !== source.gitBlob) fail('Source blob mismatch')
      if (source.url !== `${catalog.repository}/blob/${catalog.sourceRevision}/${source.path}`) fail('Unpinned source link')
      if (!['missing', 'different', 'identical'].includes(source.siteCopy)) fail('Invalid site copy status')
      consumed.add(source.path)
    }
    if (item.existingSiteRoute && !/^#\/article\/[a-z0-9-]+$/.test(item.existingSiteRoute)) fail('Invalid existing route')
    if (item.actions.some(action => !actionLabels[action])) fail('Unknown editorial action')
    if (!['pinned-links-found-needs-review', 'no-direct-pinned-link-found'].includes(item.versionEvidence.status)) fail('Invalid version evidence status')
    for (const reference of item.versionEvidence.references) if (!/^[a-f0-9]{7,40}$/i.test(reference.revision) || !reference.evidenceUrl.includes(reference.revision)) fail('Unpinned implementation evidence')
  }
  for (const entry of inventory.values()) if (materialPattern.test(entry.path) && !consumed.has(entry.path)) fail(`Unmapped source material: ${entry.path}`)
  if (new Set(catalog.planned.map(item => item.sourcePath)).size !== catalog.planned.length) fail('Duplicate planned file')
  for (const item of catalog.planned) {
    assertSafePath(item.sourcePath)
    if (materials.has(item.sourcePath) || item.status !== 'planned-file-absent') fail('Planned course already exists or has false availability')
    if (!topics.has(item.topicId) || !materials.has(item.evidencePath)) fail('Missing planned-course evidence')
    for (const id of item.relatedExistingMaterialIds) if (!catalog.materials.some(material => material.id === id && material.topicId === item.topicId)) fail('Invalid related existing course')
  }
  if (catalog.learningPaths.length !== 4 || new Set(catalog.learningPaths.map(item => item.id)).size !== 4) fail('Expected four unique learning paths')
  for (const path of catalog.learningPaths) {
    const steps = [...path.steps, ...path.optional, ...(path.branches ?? []).flatMap(branch => branch.steps)]
    for (const step of steps) {
      const material = materials.get(step.sourcePath)
      if (!material || ['license', 'maintenance', 'resource-index'].includes(material.role)) fail(`Unavailable learning step: ${step.sourcePath}`)
      if (!step.goal) fail('Learning step lacks outcome')
    }
  }
  if (JSON.stringify(catalog).match(/\/Users\/|\/home\/|OPENAI_API_KEY|file:\/\//)) fail('Private environment detail in catalog')
  return true
}

const cell = value => String(value).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ')
export function renderCatalog(catalog) {
  const topicMap = new Map(catalog.topics.map(topic => [topic.id, topic]))
  const materialMap = new Map(catalog.materials.map(item => [item.sourcePath, item]))
  const sourceLink = item => `[${cell(item.title)}](${(item.sources.zh ?? item.sources.en).url})`
  const lines = ['# 课程内容映射表', '', '> 生成自人工分类规则与固定 Git 对象。用途为课程规划，本文件不驱动网站。', '',
    `教程基线：\`${catalog.sourceRevision}\`；网站对照基线：\`${catalog.siteRevision}\`；盘点日期：${catalog.auditedAt}。`, '',
    `${catalog.materials.length} 项材料（含目录、代码、图表及维护资料），${catalog.topics.length} 个主题，${catalog.planned.length} 项明确列出的计划文件。所有条目仅确认源码存在；没有在本轮执行设备实验。`, '',
    '平台列表示材料涉及的平台或示例依赖，不表示组合兼容或部署支持。先修关系是编辑建议；原文固定版本链接只做提取，需逐篇确认其适用范围。现有站内链接按原值保留，未生成未来链接。', '',
    '## 四条学习路线', '']
  for (const path of catalog.learningPaths) {
    lines.push(`### ${path.title}`, '', `入口要求：${path.entryRequirements}`, '', `目标：${path.outcome}`, '')
    for (const [index, step] of path.steps.entries()) lines.push(`${index + 1}. ${sourceLink(materialMap.get(step.sourcePath))}：${step.goal}${step.section ? `（${step.section}）` : ''}。`)
    lines.push('')
    for (const branch of path.branches ?? []) { lines.push(`**${branch.title}**`, ''); for (const step of branch.steps) lines.push(`- ${sourceLink(materialMap.get(step.sourcePath))}：${step.goal}。`); lines.push('') }
    if (path.optional.length) { lines.push('按需选读：', ''); for (const step of path.optional) lines.push(`- ${sourceLink(materialMap.get(step.sourcePath))}：${step.goal}。`); lines.push('') }
  }
  for (const domain of catalog.domains) {
    lines.push(`## ${domain.title}`, '')
    for (const topic of catalog.topics.filter(item => item.domainId === domain.id)) {
      lines.push(`### ${topic.title}`, '', `建议先修：${topic.prerequisites.map(id => topicMap.get(id).title).join('；') || '无专题前置要求'}。`, '', '| 材料 / 固定来源 | 角色 / 层次 / 难度 | 平台范围 | 语言 | 站内映射 / 副本 | 整理动作 |', '|---|---|---|---|---|---|')
      for (const item of catalog.materials.filter(item => item.topicId === topic.id)) {
        const route = item.existingSiteRoute ? `[原链接](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/${item.existingSiteRoute})` : '未建文章索引'
        const copies = Object.entries(item.sources).map(([lang, source]) => `${lang}:${copyLabels[source.siteCopy]}`).join(' / ')
        lines.push(`| ${sourceLink(item)} | ${roles[item.role]} / ${layers[item.layer]} / ${difficulties[item.difficulty]} | ${item.platformScope.join(', ')} | ${item.availableLanguages.join(' / ')} | ${route}；${copies} | ${item.actions.map(action => actionLabels[action]).join('；') || '保留并归类'} |`)
        if (item.notes.length) lines.push(`| ↳ ${cell(item.notes.join(' '))} | | | | | |`)
        if (JSON.stringify(item.prerequisites) !== JSON.stringify(topic.prerequisites)) lines.push(`| ↳ 本材料先修：${cell(item.prerequisites.map(id => topicMap.get(id).title).join('；'))} | | | | | |`)
      }
      lines.push('')
    }
  }
  lines.push('## 计划文件（不能显示为已有课程）', '', '以下文件尚不存在，但相关知识可能已经由其他教程覆盖。JSON 中列出同主题已有材料 ID，不能把“计划文件缺失”等同于“知识完全空缺”。', '', '| 计划主题 | 原目录计划文件 | 计划依据 |', '|---|---|---|')
  for (const item of catalog.planned) lines.push(`| ${item.title} | \`${item.sourcePath}\` | [原始计划](${item.evidenceUrl}) |`)
  lines.push('', '## 语言与站内副本差异', '', '英文正文缺失：', '')
  for (const item of catalog.materials.filter(item => item.sourcePath.endsWith('.md') && !item.sources.en)) lines.push(`- ${sourceLink(item)}。`)
  lines.push('', '仅在旧站内索引存在的材料：', '', ...(catalog.existingSiteOnly.length ? catalog.existingSiteOnly.map(item => `- \`${item.sourcePath}\` → \`${item.route}\``) : ['无。']), '', '完整的每语言 Git blob、固定来源、引用版本证据、网站副本差异及资源清单见 [catalog.json](catalog.json)。源文件本轮未同步。', '')
  return lines.join('\n')
}

export async function generate({ sourceRoot, check = false } = {}) {
  if (!sourceRoot) fail('Pass --source <local-tutor-checkout>; no implicit home-directory discovery')
  const source = readSnapshot(resolve(sourceRoot), plan.sourceRevision, 'learning')
  const site = readSnapshot(projectRoot, plan.siteRevision, 'src/data')
  const catalog = buildCatalog(source, site)
  const outputs = [
    ['docs/curriculum/catalog.json', `${JSON.stringify(catalog, null, 2)}\n`],
    ['docs/curriculum/catalog.md', renderCatalog(catalog)],
  ]
  for (const [path, content] of outputs) {
    const destination = resolve(projectRoot, path)
    if (check) { if (await readFile(destination, 'utf8') !== content) fail(`Stale generated catalog: ${path}`) }
    else await writeFile(destination, content)
  }
  console.log(`Curriculum plan: ${catalog.materials.length} materials; ${catalog.inventory.length} tracked files; ${catalog.planned.length} planned files; website unchanged.`)
  return catalog
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf('--source')
  if (index < 0 || !process.argv[index + 1] || process.argv[index + 1].startsWith('--')) fail('Usage: node scripts/curriculum-plan.mjs --source <local-tutor-checkout> [--check]')
  await generate({ sourceRoot: process.argv[index + 1], check: process.argv.includes('--check') })
}
