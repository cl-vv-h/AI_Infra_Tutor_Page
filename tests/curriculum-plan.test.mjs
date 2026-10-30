import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { assertAcyclicTopics, assertSafePath, extractVersions, readSnapshot, renderCatalog, validateCatalog } from '../scripts/curriculum-plan.mjs'
import { assignments, sourceRevision, siteRevision } from '../docs/curriculum/plan.mjs'

const catalog = JSON.parse(await readFile(new URL('../docs/curriculum/catalog.json', import.meta.url), 'utf8'))
function invalid(change, pattern) {
  const copy = structuredClone(catalog)
  change(copy)
  assert.throws(() => validateCatalog(copy), pattern)
}

test('complete bilingual inventory is classified exactly once against fixed source and site versions', () => {
  assert.equal(validateCatalog(catalog), true)
  assert.equal(catalog.sourceRevision, sourceRevision)
  assert.equal(catalog.siteRevision, siteRevision)
  assert.equal(catalog.inventory.length, 467)
  assert.equal(catalog.materials.length, 182)
  assert.deepEqual(new Set(catalog.materials.map(item => item.sourcePath)), new Set(assignments.map(item => item.sourcePath)))
  assert.equal(catalog.materials.filter(item => item.role === 'experiment').length, 22)
  assert.equal(catalog.materials.filter(item => item.role === 'annotated-source').length, 3)
  assert.equal(catalog.materials.filter(item => item.role === 'visualization').length, 6)
  assert.equal(catalog.existingSiteOnly.length, 0)
  assert.equal(catalog.materials.filter(item => item.existingSiteRoute).length, 139)
})

test('missing or newly added material cannot be silently dropped or assigned twice', () => {
  invalid(c => { c.materials.pop() }, /Unmapped/)
  invalid(c => { c.materials.push(c.materials[0]) }, /Duplicate/)
  invalid(c => { c.inventory.push({ path: 'learning/en/new-course.md', gitBlob: 'a'.repeat(40), kind: 'localized-material' }) }, /Unmapped/)
  invalid(c => { c.inventory.find(item => item.kind === 'localized-material').kind = 'maintenance' }, /classification/)
})

test('prerequisites reject cycles, unknown topics and self dependency', () => {
  assert.throws(() => assertAcyclicTopics([{ id: 'a', prerequisites: ['b'] }, { id: 'b', prerequisites: ['a'] }]), /Cyclic/)
  invalid(c => { c.topics[0].prerequisites.push('missing') }, /Unknown/)
  invalid(c => { c.materials[0].prerequisites.push(c.materials[0].topicId) }, /Self/)
  invalid(c => { c.materials[0].domainId = 'basics' }, /topic\/domain/)
})

test('translation availability reflects actual files, with six Chinese-only documents', () => {
  const missing = catalog.materials.filter(item => item.sourcePath.endsWith('.md') && !item.sources.en)
  assert.equal(missing.length, 6)
  assert.equal(missing.filter(item => item.sourcePath.includes('/Quantization/')).length, 5)
  assert.ok(missing.some(item => item.sourcePath.includes('qwen3.5-hybrid')))
  invalid(c => { c.materials.find(item => !item.sources.en).availableLanguages.push('en') }, /translation/)
  invalid(c => { c.materials[0].sources.zh.gitBlob = 'b'.repeat(40) }, /blob mismatch/)
})

test('planned chapters remain unavailable even when another article covers the topic', () => {
  assert.equal(catalog.planned.length, 16)
  assert.ok(catalog.planned.every(item => item.relatedExistingMaterialIds.length > 0))
  invalid(c => { c.planned[0].sourcePath = c.materials[0].sourcePath }, /already exists/)
  invalid(c => { c.planned[0].evidencePath = 'missing.md' }, /evidence/)
  invalid(c => { c.learningPaths[0].steps[0].sourcePath = c.planned[0].sourcePath }, /Unavailable/)
})

test('learning routes do not treat maintenance files or licenses as lessons', () => {
  invalid(c => { c.learningPaths[0].steps[0].sourcePath = c.materials.find(item => item.role === 'license').sourcePath }, /Unavailable/)
  invalid(c => { c.learningPaths[0].steps[0].goal = '' }, /outcome/)
  assert.equal(catalog.learningPaths.find(item => item.id === 'ascend-kernels').branches.length, 2)
})

test('historical SP demo is explicitly CP, and MoE routing is separate from service routing', () => {
  const sp = catalog.materials.find(item => item.sourcePath.endsWith('/sp_inference_demo.py'))
  assert.equal(sp.topicId, 'context-parallel')
  assert.match(sp.title, /CP.*历史文件名/)
  const router = catalog.materials.find(item => item.sourcePath.endsWith('/09-router.md'))
  assert.equal(router.topicId, 'service-router')
  assert.ok(router.relatedTopics.includes('moe'))
  assert.ok(router.actions.includes('split-service-and-expert-routing'))
  assert.equal(catalog.materials.find(item => item.sourcePath.endsWith('10-manifold-constrained-hyper-connections.md')).topicId, 'residual')
})

test('version links are evidence requiring review, never hardware validation', () => {
  const references = extractVersions('https://github.com/example/repo/blob/abcdef1234/src.py https://github.com/example/repo/tree/main https://huggingface.co/example/model/blob/1234567/config.json')
  assert.equal(references.length, 2)
  assert.equal(references[0].revision, 'abcdef1234')
  assert.equal(references[1].repository, 'https://huggingface.co/example/model')
  invalid(c => { c.materials[0].verification = 'npu-tested' }, /execution claim/)
  invalid(c => { c.materials[0].sources.zh.url = c.materials[0].sources.zh.url.replace(c.sourceRevision, 'main') }, /Unpinned/)
})

test('private paths, traversal, unsupported schemas and invented website routes are rejected', () => {
  for (const path of ['../private', '/private', 'C:/private', 'x\\y', 'x/../y', 'x\ny']) assert.throws(() => assertSafePath(path), /Unsafe/)
  invalid(c => { c.schemaVersion = 2 }, /Unsupported/)
  invalid(c => { c.materials[0].notes.push('/Users/example/private') }, /Private/)
  invalid(c => { c.materials[0].existingSiteRoute = '#/future/imaginary' }, /route/)
})

test('readable mapping stays reproducible and preserves technical underscores', async () => {
  assert.equal(renderCatalog(catalog), await readFile(new URL('../docs/curriculum/catalog.md', import.meta.url), 'utf8'))
  assert.match(renderCatalog(catalog), /torch_npu/)
  assert.doesNotMatch(renderCatalog(catalog), /torchnpu/)
})

test('snapshot reader uses pinned Git objects and ignores working-tree edits and untracked files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'curriculum-snapshot-'))
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' })
  try {
    git('init', '-q')
    await mkdir(join(root, 'learning/zh'), { recursive: true })
    await writeFile(join(root, 'learning/zh/lesson.md'), '# committed lesson\n')
    git('add', 'learning')
    git('-c', 'user.name=Curriculum Test', '-c', 'user.email=curriculum-test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture')
    const revision = git('rev-parse', 'HEAD').trim()
    await writeFile(join(root, 'learning/zh/lesson.md'), 'uncommitted private draft')
    await writeFile(join(root, 'learning/zh/private.md'), 'untracked private draft')
    const snapshot = readSnapshot(root, revision, 'learning')
    assert.deepEqual(snapshot.entries.map(item => item.path), ['learning/zh/lesson.md'])
    assert.equal(snapshot.read('learning/zh/lesson.md'), '# committed lesson\n')
    assert.throws(() => readSnapshot(root, 'HEAD', 'learning'), /fixed commit/)
  } finally { await rm(root, { recursive: true, force: true }) }
})
