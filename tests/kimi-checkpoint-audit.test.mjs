import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { readBounded, validateHeader, parseIndex, tensorRole } from '../scripts/kimi-checkpoint-audit.mjs'

test('weight range reads reject full responses before consuming their payload', async () => {
  let reads = 0
  let cancelled = false
  const response = { status: 200, headers: new Headers(), body: { cancel: async () => { cancelled = true }, getReader: () => { reads++; throw Error('must not read') } } }
  await assert.rejects(readBounded(response, 8, 'bytes 0-7/9999999999'), /HTTP/)
  assert.equal(reads, 0)
  assert.equal(cancelled, true)
})

test('metadata reader validates exact range, length, truncation and upper bounds', async () => {
  const r = (body, headers = {}) => new Response(body, { status: 206, headers: { 'content-range': 'bytes 0-7/100', ...headers } })
  assert.equal((await readBounded(r('12345678'), 8, 'bytes 0-7/100')).toString(), '12345678')
  await assert.rejects(readBounded(r('12345678'), 8, 'bytes 0-7/101'), /HTTP/)
  await assert.rejects(readBounded(r('12345678', { 'content-length': '9' }), 8, 'bytes 0-7/100'), /Length/)
  await assert.rejects(readBounded(r('123'), 8, 'bytes 0-7/100'), /Truncated/)
  await assert.rejects(readBounded(r('123456789'), 8, 'bytes 0-7/100'), /limit/)
  assert.throws(() => parseIndex(Buffer.from('{}')), /SHA-256/)
})

test('safetensors validates storage dtype and exact shape/offset/index coverage', () => {
  const file = { name: 's.safetensors', size: 108 }
  const map = { a: file.name, b: file.name }
  const header = { a: { dtype: 'BF16', shape: [2, 4], data_offsets: [0, 16] }, b: { dtype: 'U8', shape: [4], data_offsets: [16, 20] } }
  assert.equal(validateHeader(header, 80, file, map).reduce((a, t) => a + t.bytes, 0), 20)
  for (const patch of [{ dtype: 'F4' }, { dtype: '__proto__' }, { shape: [-1, 8] }, { shape: [Number.MAX_SAFE_INTEGER, 8] }, { data_offsets: [0, 8] }]) {
    assert.throws(() => validateHeader({ ...header, a: { ...header.a, ...patch } }, 80, file, map))
  }
  assert.throws(() => validateHeader(header, 79, file, map), /size/)
  assert.throws(() => validateHeader(header, 80, file, { ...map, b: 'wrong' }), /shard/)
  assert.throws(() => validateHeader({ ...header, b: { ...header.b, data_offsets: [15, 19] } }, 80, file, map), /overlapping/)
})

test('native audit independently reconciles 96 files, all templates, roles and decoder layers', () => {
  const audit = JSON.parse(readFileSync(new URL('../src/data/kimi-checkpoint-audit.json', import.meta.url)))
  assert.equal(audit.files.length, 96)
  assert.equal(audit.index.sha256, 'a1c5210650ce71d2d3ae9ec5a101ac4afd3cf4b10091be589853437eb967febd')
  assert.equal(audit.index.verifiedSha256, true)
  assert.equal(audit.files[0].sha256, '975584c00f85a95fce8ae0f840af8cef69c2ef4db00d34cab3e2cbdfc60f6e51')
  assert.equal(audit.files[95].sha256, '9d10c74fc10161bef9463a8541a634a97f521f43c99368ea7243ce0c79cdbf7c')
  assert.equal(audit.fileBytes, 1560936091448)
  assert.equal(audit.fileBytes, audit.payloadBytes + audit.headerBytes)
  assert.equal(audit.payloadBytes, audit.index.totalSize)
  for (const [field, total] of [['size', audit.fileBytes], ['payloadBytes', audit.payloadBytes], ['headerBytes', audit.headerBytes], ['tensorCount', audit.tensorCount]]) assert.equal(audit.files.reduce((a, f) => a + f[field], 0), total)
  assert.equal(audit.groups.reduce((a, g) => a + g.bytes, 0), audit.payloadBytes)
  assert.equal(audit.groups.reduce((a, g) => a + g.tensorCount, 0), audit.tensorCount)
  assert.equal(audit.templates.reduce((a, t) => a + t.bytes, 0), audit.payloadBytes)
  assert.equal(audit.templates.reduce((a, t) => a + t.count, 0), audit.tensorCount)
  const widths = { BF16: 2, F32: 4, U8: 1 }
  for (const t of audit.templates) assert.equal(t.bytes, t.shape.reduce((a, b) => a * b, 1) * widths[t.dtype] * t.count, t.name)
  assert.equal(audit.layerBytes.length, 93)
  assert.equal(audit.layerBytes.reduce((a, n) => a + n, 0), audit.decoderBytes)
  assert.equal(audit.metadataBytesRead, audit.index.size + audit.headerBytes)
  assert.match(audit.verification, /not downloaded or hashed/)
  assert.equal(tensorRole('language_model.model.layers.1.mlp.experts.0.w1.weight'), 'routed-experts')
  assert.equal(tensorRole('language_model.model.layers.1.mlp.gate.weight'), 'router')
  assert.equal(tensorRole('language_model.model.layers.1.block_sparse_moe.gate.weight'), 'router')
  const template = suffix => audit.templates.find(t => t.name.endsWith(suffix))
  assert.deepEqual(template('.experts.{expert}.w1.weight_packed').shape, [3072, 1792])
  assert.deepEqual(template('.experts.{expert}.w2.weight_scale').shape, [3584, 96])
  assert.equal(template('.experts.{expert}.w1.weight_scale').count, 92 * 896)
  assert.equal(template('.gate.weight').dtype, 'BF16')
  assert.equal(template('.gate.e_score_correction_bias').dtype, 'F32')
  assert.deepEqual(template('.self_attn.A_log').shape, [128])
  const routed = audit.templates.filter(t => t.name.includes('.experts.'))
  assert.equal(routed.filter(t => t.name.endsWith('.weight_packed')).reduce((a, t) => a + t.bytes, 0), 92 * 896 * 3 * 3584 * 3072 / 2)
  assert.equal(routed.filter(t => t.name.endsWith('.weight_scale')).reduce((a, t) => a + t.bytes, 0), 92 * 896 * 3 * 3584 * 3072 / 32)
  assert.doesNotMatch(JSON.stringify(audit), /CommitterName|CommitMessage|\/Users\/|@|token=|Signature=/i)
})
