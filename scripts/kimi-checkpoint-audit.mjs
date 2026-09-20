import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

export const INDEX = { name: 'model.safetensors.index.json', size: 59764096, sha256: 'a1c5210650ce71d2d3ae9ec5a101ac4afd3cf4b10091be589853437eb967febd' }
const ROOT = 'https://modelscope.cn'
const MODEL = 'moonshotai/Kimi-K3'
const WIDTH = { BOOL: 1, U8: 1, I8: 1, F8_E4M3: 1, F8_E5M2: 1, I16: 2, U16: 2, F16: 2, BF16: 2, I32: 4, U32: 4, F32: 4, I64: 8, U64: 8, F64: 8 }
const integer = n => Number.isSafeInteger(n) && n >= 0
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x)

/** Never consume a 200 response to a weight range request. No weight payload is read. */
export async function readBounded(response, expected, range) {
  if (response.status !== (range ? 206 : 200) || (range && response.headers.get('content-range') !== range)) {
    await response.body?.cancel()
    throw new Error('Unexpected HTTP status or Content-Range')
  }
  const length = response.headers.get('content-length')
  if (length !== null && Number(length) !== expected) {
    await response.body?.cancel()
    throw new Error('Unexpected Content-Length')
  }
  if (!response.body) throw new Error('Missing response body')
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > expected) throw new Error('Metadata exceeds byte limit')
      chunks.push(value)
    }
    if (size !== expected) throw new Error('Truncated metadata')
    return Buffer.concat(chunks, size)
  } finally { await reader.cancel(); reader.releaseLock() }
}

export function parseIndex(bytes) {
  if (bytes.length !== INDEX.size || createHash('sha256').update(bytes).digest('hex') !== INDEX.sha256) throw new Error('Index size/SHA-256 mismatch')
  const index = JSON.parse(bytes.toString('utf8'))
  if (!object(index.weight_map) || !integer(index.metadata?.total_size)) throw new Error('Invalid index schema')
  return index
}

export function validateHeader(header, headerLength, file, weightMap) {
  if (!object(header)) throw new Error('Invalid header')
  const tensors = []
  for (const [name, tensor] of Object.entries(header)) {
    if (name === '__metadata__') continue
    if (!object(tensor) || !Object.hasOwn(WIDTH, tensor.dtype) || !Array.isArray(tensor.shape) || !tensor.shape.every(integer) ||
      !Array.isArray(tensor.data_offsets) || tensor.data_offsets.length !== 2 || !tensor.data_offsets.every(integer)) throw new Error('Invalid tensor metadata')
    const [start, end] = tensor.data_offsets
    const elements = tensor.shape.reduce((a, b) => a * b, 1)
    const bytes = elements * WIDTH[tensor.dtype]
    if (!integer(bytes) || end - start !== bytes) throw new Error('Shape/dtype/offset byte mismatch')
    if (weightMap[name] !== file.name) throw new Error('Header/index shard mismatch')
    tensors.push({ name, dtype: tensor.dtype, shape: tensor.shape, bytes, start, end })
  }
  tensors.sort((a, b) => a.start - b.start || a.end - b.end)
  let end = 0
  for (const tensor of tensors) {
    if (tensor.start !== end) throw new Error('Non-contiguous or overlapping tensor payload')
    end = tensor.end
  }
  if (end + headerLength + 8 !== file.size) throw new Error('File/header/payload size mismatch')
  return tensors
}

export function tensorRole(name) {
  if (name.startsWith('vision_tower.')) return 'vision'
  if (name.startsWith('mm_projector.')) return 'projector'
  if (name.includes('.embed_tokens.')) return 'embedding'
  if (name.includes('.lm_head.')) return 'lm-head'
  if (/\.layers\.\d+\./.test(name)) {
    if (/\.experts\.\d+\./.test(name)) return 'routed-experts'
    if (name.includes('.shared_experts.')) return 'shared-experts'
    if (name.includes('.self_attn.')) return 'attention'
    if (/\.(mlp|block_sparse_moe)\.gate\./.test(name) || name.includes('e_score_correction_bias')) return 'router'
    if (name.includes('.block_sparse_moe.routed_expert_')) return 'latent-projections'
    if (name.includes('.mlp.')) return 'other-mlp'
    return 'decoder-norm-residual'
  }
  return 'other'
}

export async function auditCheckpoint() {
  const get = async (url, headers) => {
    for (let hop = 0; hop < 4; hop++) {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !['modelscope.cn', 'cdn-lfs-cn-1.modelscope.cn'].includes(parsed.hostname)) throw new Error('Unapproved metadata origin')
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(60000), redirect: 'manual' })
      if (![301, 302, 303, 307, 308].includes(response.status)) return response
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (!location) throw new Error('Missing redirect location')
      url = new URL(location, url).href
    }
    throw new Error('Too many metadata redirects')
  }
  const listingResponse = await get(`${ROOT}/api/v1/models/${MODEL}/repo/files?Revision=master&Recursive=true`)
  if (!listingResponse.ok) throw new Error('File listing request failed')
  const listingText = await listingResponse.text()
  if (listingText.length > 2_000_000) throw new Error('File listing too large')
  const listing = JSON.parse(listingText)
  if (listing.Code !== 200 || !Array.isArray(listing.Data?.Files)) throw new Error('Invalid file listing')
  // Only public artifact identifiers enter the audit. Discard authors and commit messages.
  const files = listing.Data.Files.filter(f => /^model-\d{5}-of-000096\.safetensors$/.test(f.Name)).map(f => ({ name: f.Name, size: f.Size, sha256: f.Sha256, revision: f.Revision })).sort((a, b) => a.name.localeCompare(b.name))
  if (files.length !== 96 || new Set(files.map(f => f.name)).size !== 96 || files.some((f, i) => f.name !== `model-${String(i + 1).padStart(5, '0')}-of-000096.safetensors` || !integer(f.size) || !/^[a-f0-9]{64}$/.test(f.sha256) || !/^[a-f0-9]{40}$/.test(f.revision))) throw new Error('Incomplete or invalid shard manifest')
  const idx = listing.Data.Files.find(f => f.Name === INDEX.name)
  if (!idx || idx.Size !== INDEX.size || idx.Sha256 !== INDEX.sha256 || !/^[a-f0-9]{40}$/.test(idx.Revision)) throw new Error('Official index identity mismatch')
  const url = (name, revision) => `${ROOT}/models/${MODEL}/resolve/${revision}/${name}`
  const index = parseIndex(await readBounded(await get(url(INDEX.name, idx.Revision)), INDEX.size))
  const shardSet = new Set(files.map(f => f.name))
  if (Object.values(index.weight_map).some(f => !shardSet.has(f))) throw new Error('Index names unknown shard')
  const seen = new Set()
  const groups = new Map()
  const templates = new Map()
  const layerBytes = Array.from({ length: 93 }, () => 0)
  let cursor = 0
  let metadataBytes = INDEX.size
  async function worker() {
    while (cursor < files.length) {
      const file = files[cursor++]
      const range = async (start, end) => readBounded(await get(url(file.name, file.revision), { Range: `bytes=${start}-${end}` }), end - start + 1, `bytes ${start}-${end}/${file.size}`)
      const prefix = await range(0, 7)
      const headerLength = Number(prefix.readBigUInt64LE())
      if (!integer(headerLength) || headerLength < 2 || headerLength > 16_000_000 || headerLength + 8 >= file.size) throw new Error('Invalid header byte length')
      metadataBytes += headerLength + 8
      if (metadataBytes > 256_000_000) throw new Error('Total metadata limit exceeded')
      const raw = await range(8, headerLength + 7)
      const tensors = validateHeader(JSON.parse(raw.toString('utf8')), headerLength, file, index.weight_map)
      file.headerBytes = headerLength + 8
      file.headerSha256 = createHash('sha256').update(raw).digest('hex')
      file.payloadBytes = file.size - file.headerBytes
      file.tensorCount = tensors.length
      for (const tensor of tensors) {
        if (seen.has(tensor.name)) throw new Error('Duplicate tensor')
        seen.add(tensor.name)
        const role = tensorRole(tensor.name)
        const key = `${role}:${tensor.dtype}`
        const group = groups.get(key) ?? { role, dtype: tensor.dtype, tensorCount: 0, bytes: 0 }
        group.tensorCount++; group.bytes += tensor.bytes; groups.set(key, group)
        const layer = tensor.name.match(/^language_model\.model\.layers\.(\d+)\./)
        if (layer) {
          if (+layer[1] >= 93) throw new Error('Unexpected decoder layer')
          layerBytes[+layer[1]] += tensor.bytes
        }
        const name = tensor.name.replace(/\.layers\.\d+\./g, '.layers.{layer}.').replace(/\.experts\.\d+\./g, '.experts.{expert}.')
        const templateKey = `${name}:${tensor.dtype}:${tensor.shape.join(',')}`
        const template = templates.get(templateKey) ?? { name, dtype: tensor.dtype, shape: tensor.shape, count: 0, bytes: 0 }
        template.count++; template.bytes += tensor.bytes; templates.set(templateKey, template)
      }
      process.stderr.write(`Audited ${file.name}: ${tensors.length} tensors\n`)
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  if (seen.size !== Object.keys(index.weight_map).length || Object.keys(index.weight_map).some(name => !seen.has(name))) throw new Error('Incomplete index/header coverage')
  const sum = field => files.reduce((a, f) => a + f[field], 0)
  if (sum('payloadBytes') !== index.metadata.total_size) throw new Error('Index/header total_size mismatch')
  return { schemaVersion: 1, auditedAt: new Date().toISOString(), source: `${ROOT}/models/${MODEL}`, hfIndexSource: 'https://huggingface.co/moonshotai/Kimi-K3/raw/main/model.safetensors.index.json',
    index: { ...INDEX, revision: idx.Revision, verifiedSha256: true, totalSize: index.metadata.total_size },
    verification: 'Index SHA-256 verified; all shard headers cross-checked against index, dtype/shape/offsets and declared file sizes. Weight payloads were not downloaded or hashed. Shard SHA-256 values are publisher metadata, not independently verified hashes.',
    tensorCount: seen.size, fileBytes: sum('size'), headerBytes: sum('headerBytes'), payloadBytes: sum('payloadBytes'), metadataBytesRead: metadataBytes,
    decoderBytes: layerBytes.reduce((a, b) => a + b, 0), layerBytes,
    groups: [...groups.values()].sort((a, b) => `${a.role}:${a.dtype}`.localeCompare(`${b.role}:${b.dtype}`)),
    templates: [...templates.values()].sort((a, b) => `${a.name}:${a.dtype}`.localeCompare(`${b.name}:${b.dtype}`)), files }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = process.argv[2]
  if (!output) throw new Error('Usage: node scripts/kimi-checkpoint-audit.mjs <generated-audit.json>')
  const audit = await auditCheckpoint()
  await writeFile(output, `${JSON.stringify(audit, null, 2)}\n`)
  console.log(JSON.stringify({ tensorCount: audit.tensorCount, fileBytes: audit.fileBytes, payloadBytes: audit.payloadBytes, decoderBytes: audit.decoderBytes, groups: audit.groups, templateCount: audit.templates.length }))
}
