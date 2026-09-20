import assert from 'node:assert/strict'
import test from 'node:test'
import { kimiNativeLayout } from '../src/lib/kimi-native-layout.ts'
import checkpoint from '../src/data/kimi-checkpoint-audit.json' with { type: 'json' }

const group = (data, role) => data.groups.find(g => g.role === role).bytes
test('TP1 initial allocation bridges all native payload with exact casts, narrowing and extra zero biases', () => {
  const d = kimiNativeLayout(1, 1)
  assert.equal(d.parametersBytes, checkpoint.payloadBytes - 69 * 32 * 4 - 69 * 128 * 2)
  assert.equal(d.addedBiasBytes, 92 * 896 * (2 * 3072 + 3584) * 2)
  assert.equal(d.bytes, 1562464095360)
  assert.equal(d.rows.length, checkpoint.templates.length)
  assert.equal(d.groups.reduce((a, g) => a + g.bytes, 0), d.parametersBytes)
  assert.equal(d.expertBuffers.length, 6)
  assert.equal(d.expertBuffers.filter(b => b.kind === 'checkpoint').reduce((a, b) => a + b.bytes * 92, 0), group(d, 'experts'))
})

test('all TP/EP/DP layouts agree with independent full-model formulas, including replicated vision MLPs', () => {
  const H = 7168, latent = 3584, I = 3072
  const kdaRep = 128 * H * 2 + 128 * 2
  const kdaShard = (5 * 12288 * H + 12288 * 128 + 96 * H) * 2 + (3 * 12288 * 4 + 12288 + 96) * 4
  const mlaRep = (1536 * H + 1536 + 576 * H + 512) * 2
  const mlaShard = (96 * 192 * 1536 + 96 * 256 * 512 + 2 * 96 * 128 * H) * 2
  for (const tp of [1, 2, 4, 8]) for (const ep of [1, 2, 4, 8].filter(e => e <= tp)) for (const dp of [1, 2, 4, 8]) {
    const d = kimiNativeLayout(tp, ep, dp, tp * dp - 1)
    const expected = {
      experts: 92 * 896 * 3 * I * latent * (1 / 2 + 1 / 32) / tp,
      router: 92 * (896 * H * 2 + 896 * 4),
      latent: 92 * (2 * latent * H + latent) * 2,
      shared: 92 * 3 * 6144 * H * 2 / tp,
      dense: 3 * 33792 * H * 2 / tp,
      attention: 69 * (kdaRep + kdaShard / tp) + 24 * (mlaRep + mlaShard / tp),
      norms: 93 * 6 * H * 2,
      embedding: 163840 * H * 2 / tp,
      head: 163840 * H * 2 / tp,
      vision: 802428928 + 92289024,
      output: 3 * H * 2,
    }
    for (const [role, bytes] of Object.entries(expected)) assert.equal(group(d, role), bytes, `${tp}/${ep}/${dp}: ${role}`)
    assert.equal(d.parametersBytes, Object.values(expected).reduce((a, b) => a + b, 0))
    assert.equal(d.addedBiasBytes, 92 * 896 / ep * (2 * I / (tp / ep) + latent) * 2)
    assert.equal(d.fleetBytes, d.bytes * tp * dp)
    assert.equal(d.replica, dp - 1)
    assert.equal(d.tpRank, tp - 1)
    assert.equal(d.epRank, ep - 1)
    assert.equal(d.moeTpRank, tp / ep - 1)
    assert.deepEqual(d.expertRange, [896 - 896 / ep, 896])
  }
})

test('rank source intervals and storage dimensions partition expert OUT/IN only once', () => {
  for (const tp of [1, 2, 4, 8]) for (const ep of [1, 2, 4, 8].filter(e => e <= tp)) for (let rank = 0; rank < tp; rank++) {
    const d = kimiNativeLayout(tp, ep, 1, rank)
    const mtp = tp / ep, mr = rank % mtp
    for (const row of d.rows.filter(r => r.role === 'experts')) {
      assert.equal(row.copies, 92 * 896 / ep)
      assert.equal(row.axis, row.name.includes('.w2.') ? 1 : 0)
      const expectedShape = [...row.checkpointShape]
      expectedShape[row.axis] /= mtp
      assert.deepEqual(row.shape, expectedShape)
      assert.deepEqual(row.range, [mr * expectedShape[row.axis], (mr + 1) * expectedShape[row.axis]])
    }
    const a = d.rows.find(r => r.name.endsWith('.A_log'))
    assert.deepEqual(a.shape, [1, 1, 96 / tp, 1])
    assert.equal(a.dtype, 'F32')
    const gate = d.rows.find(r => r.name.endsWith('.gate.weight'))
    assert.equal(gate.dtype, 'BF16', 'FP32 output logits do not imply FP32 stored router weights')
    assert.equal(gate.range, null)
    assert.deepEqual(d.expertBuffers[0].shape, [896 / ep, 6144 / mtp, 1792])
    assert.deepEqual(d.expertBuffers[3].shape, [896 / ep, 3584, 96 / mtp])
  }
})

test('EP changes replicated zero down-bias count; native payload itself is invariant at fixed TP', () => {
  const a = kimiNativeLayout(8, 1), b = kimiNativeLayout(8, 8)
  assert.equal(a.parametersBytes, b.parametersBytes)
  assert.equal(a.addedBiasBytes, 717488128)
  assert.equal(b.addedBiasBytes, 200474624)
  assert.equal(a.bytes - b.bytes, 517013504)
})

test('invalid topologies and out-of-group ranks are rejected', () => {
  for (const args of [[3, 1], [2, 4], [8, 3], [1, 1, 3], [1, 1, 1, -1], [4, 2, 1, 4], [4, 2, 2, 0.5]]) assert.throws(() => kimiNativeLayout(...args), /Invalid/)
})
