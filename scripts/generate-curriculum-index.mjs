import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCurriculumIndex } from './curriculum-index.mjs'

const contentRoot = new URL('../src/data/content/', import.meta.url)
const indexPath = new URL('../src/data/curriculum-index.json', import.meta.url)

export async function readCurriculumModules(root = contentRoot) {
  const modules = {}
  async function visit(relativePath) {
    const entries = await readdir(new URL(relativePath, root), { withFileTypes: true })
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const path = `${relativePath}${entry.name}`
      if (entry.isDirectory()) await visit(`${path}/`)
      else if (entry.isFile() && /\.(md|py)$/.test(entry.name)) {
        modules[`./content/${path}`] = await readFile(new URL(path, root), 'utf8')
      }
    }
  }
  await visit('')
  return modules
}

export async function generateCurriculumIndex({ check = false } = {}) {
  const articles = buildCurriculumIndex(await readCurriculumModules())
  const slugs = new Set(articles.map((article) => article.slug))
  if (slugs.size !== articles.length) throw new Error('Duplicate curriculum slugs')
  const serialized = `${JSON.stringify(articles, null, 2)}\n`
  const current = await readFile(indexPath, 'utf8').catch(() => '')
  if (check && current !== serialized) throw new Error('Curriculum index is stale. Run npm run curriculum:index.')
  if (!check && current !== serialized) await writeFile(indexPath, serialized)
  console.log(`Curriculum index: ${articles.length} articles; bodies excluded.`)
  return articles
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateCurriculumIndex({ check: process.argv.includes('--check') })
}
