import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFeatures, calculatorFingerprint, releaseMetadata } from '../scripts/release-metadata.mjs'
const root = new URL('..', import.meta.url).pathname
test('release exposes only revision, clock, definition fingerprint and effective switches', () => {
  assert.deepEqual(Object.keys(releaseMetadata(root)).sort(), ['builtAt','calculatorFingerprint','commit','features'])
  assert.match(calculatorFingerprint(root), /^[a-f0-9]{64}$/)
  assert.equal(calculatorFingerprint(root), calculatorFingerprint(root))
})
test('comparison is disabled whenever its library dependency is disabled', () => {
  const dir = mkdtempSync(join(tmpdir(), 'release-flags-'))
  try {
    mkdirSync(join(dir, 'config'))
    writeFileSync(join(dir, 'config/features.json'), JSON.stringify({scenarioLibrary:false,scenarioComparison:true}))
    assert.deepEqual(readFeatures(dir), {scenarioLibrary:false,scenarioComparison:false})
    writeFileSync(join(dir, 'config/features.json'), '{"scenarioLibrary":"true"}')
    assert.throws(() => readFeatures(dir))
  } finally { rmSync(dir, {recursive:true,force:true}) }
})
