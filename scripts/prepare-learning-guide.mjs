import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { generateCurriculumIndex } from './generate-curriculum-index.mjs'
const catalog = JSON.parse(await readFile(new URL('../docs/curriculum/catalog.json', import.meta.url)))
const root = new URL('../', import.meta.url)
// Add missing learning bodies only. Existing adapted prose is never overwritten.
if (process.argv.includes('--import-missing')) {
  const source = process.argv[process.argv.indexOf('--source') + 1]
  if (!source || !process.argv.includes('--source')) throw new Error('Provide a local source checkout')
  for (const material of catalog.materials.filter(m => ['lesson', 'experiment', 'reference', 'case-study', 'annotated-source', 'navigation'].includes(m.role))) {
    for (const file of Object.values(material.sources)) {
      const destination = new URL(`src/data/content/${file.path.replace('learning/', '')}`, root)
      try { await access(destination); continue } catch { /* New source only. */ }
      const body = execFileSync('git', ['-C', source, 'show', `${catalog.sourceRevision}:${file.path}`], {maxBuffer: 16 * 1024 * 1024})
      if (/\/Users\/|\/home\/[a-z][\w-]+\//i.test(body.toString())) throw new Error(`Review personal path before importing ${file.path}`)
      await mkdir(dirname(destination.pathname), {recursive:true}); await writeFile(destination, body)
    }
  }
}
// For new lesson images, reuse fixed source objects and retain existing adaptations.
if (process.argv.includes('--import-missing')) {
  const source = process.argv[process.argv.indexOf('--source') + 1]
  for (const file of catalog.inventory.filter(f => f.kind === 'resource' && /^learning\/(zh|en)\//.test(f.path) && /\.(svg|png|jpg|jpeg|webp|gif)$/.test(f.path))) {
    const destination = new URL(`src/data/content/${file.path.replace('learning/', '')}`, root)
    try { await access(destination); continue } catch { /* New image only. */ }
    await mkdir(dirname(destination.pathname), {recursive:true})
    await writeFile(destination, execFileSync('git', ['-C',source,'show',`${catalog.sourceRevision}:${file.path}`],{maxBuffer:20*1024*1024}))
  }
}
const index = await generateCurriculumIndex()
const excluded = new Set(['maintenance', 'license', 'resource-index', 'visualization'])
const data = {
  sourceRevision: catalog.sourceRevision, domains: catalog.domains, topics: catalog.topics,
  paths: catalog.learningPaths,
  materials: catalog.materials.filter(m => !excluded.has(m.role)).map(m => ({
    id:m.id, sourcePath:m.sourcePath, title:m.title, topicId:m.topicId, role:m.role, layer:m.layer,
    difficulty:m.difficulty, platforms:m.platformScope, prerequisites:m.prerequisites,
    languages:m.availableLanguages, sourceUrl:(m.sources.zh ?? m.sources.en).url,
    slug:index.find(a => a.sourcePath===m.sourcePath)?.slug ?? null,
  })),
  planned:catalog.planned.map(m => ({title:m.title, topicId:m.topicId, sourceUrl:m.evidenceUrl})),
}
await writeFile(new URL('src/data/learning-guide.json', root), JSON.stringify(data,null,2)+'\n')
console.log(`Learning guide: ${data.materials.length} materials, ${data.topics.length} topics; no existing bodies overwritten.`)
