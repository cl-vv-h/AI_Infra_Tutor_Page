import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const manifest = JSON.parse(await readFile(new URL('../dist/.vite/manifest.json', import.meta.url), 'utf8'))
const isBody = (key) => /src\/data\/content\/.*\.(md|py)\?raw$/.test(key)
const bodies = Object.keys(manifest).filter(isBody)
assert.ok(bodies.length > 0, 'No lazy curriculum bodies were emitted')
for (const key of bodies) assert.ok(manifest[key].isDynamicEntry, `Body is not a dynamic entry: ${key}`)

function staticDependencies(key, seen = new Set()) {
  if (seen.has(key)) return seen
  seen.add(key)
  for (const dependency of manifest[key]?.imports ?? []) staticDependencies(dependency, seen)
  return seen
}

for (const key of ['index.html', 'src/pages/Home.tsx', 'src/pages/Learn.tsx', 'src/pages/Category.tsx', 'src/pages/ModelCatalog.tsx', 'src/pages/Models.tsx', 'src/pages/ModelCompare.tsx', 'src/pages/Article.tsx']) {
  assert.ok(manifest[key], `Missing route in build: ${key}`)
  assert.equal([...staticDependencies(key)].some(isBody), false, `Route eagerly imports course bodies: ${key}`)
}
for (const key of bodies) {
  assert.equal([...staticDependencies(key)].filter(isBody).length, 1, `Article bundles another course: ${key}`)
}
console.log(`Curriculum bundle verified: ${bodies.length} isolated bodies; no eager course payload in entry or page routes.`)
