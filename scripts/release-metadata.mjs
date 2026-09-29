import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { execFileSync } from 'node:child_process'

export function readFeatures(root) {
  const flags = JSON.parse(readFileSync(resolve(root, 'config/features.json'), 'utf8'))
  if (Object.keys(flags).sort().join() !== 'scenarioComparison,scenarioLibrary' || Object.values(flags).some(v => typeof v !== 'boolean')) throw new Error('Invalid release feature flags')
  return { scenarioLibrary: flags.scenarioLibrary, scenarioComparison: flags.scenarioLibrary && flags.scenarioComparison }
}

// Hash the transitive local source graph, including model definitions. Daily news
// and build timestamps do not invalidate a saved calculator snapshot.
export function calculatorFingerprint(root) {
  const files = new Map()
  function visit(path) {
    if (files.has(path)) return
    const body = readFileSync(path, 'utf8'); files.set(path, body)
    for (const match of body.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      const spec = match[1]
      if (!spec.startsWith('.') && !spec.startsWith('@/')) continue
      const base = spec.startsWith('@/') ? resolve(root, 'src', spec.slice(2)) : resolve(dirname(path), spec)
      const next = [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`].find(existsSync)
      if (!next) throw new Error(`Unresolved calculator dependency: ${spec}`)
      visit(next)
    }
  }
  for (const path of ['src/data/models.ts', 'src/lib/model-explorer.ts', 'src/lib/weight-deployment.ts', 'src/lib/cache-capacity.ts']) visit(resolve(root, path))
  const hash = createHash('sha256')
  for (const [path, body] of [...files].sort(([a], [b]) => a.localeCompare(b))) hash.update(relative(root, path)).update('\0').update(body).update('\0')
  return hash.digest('hex')
}

export function releaseMetadata(root) {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid release revision')
  return { commit, builtAt: new Date().toISOString(), calculatorFingerprint: calculatorFingerprint(root), features: readFeatures(root) }
}
