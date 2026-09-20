/** Exact W4AFp8MoEMethod at this revision; no DeepEP, allocator or transient buffers. */
export const w4Source = 'https://github.com/sgl-project/sglang/blob/96d91ef9266d2bebd8e8c09ef1f28b2d521631ff/python/sglang/srt/layers/quantization/w4afp8.py'

export function w4InterleavedScaleShape(shape: readonly number[]) {
  if (shape.length !== 3 || shape.some(n => !Number.isSafeInteger(n) || n <= 0)) throw new Error('Invalid W4AFp8 scale shape')
  const [experts, output, groups] = shape
  const alignment = groups % 4 === 0 ? 4 : 1
  return [experts, groups / alignment, output * alignment]
}

/** Seven distinct allocations; four other attribute names alias existing strides. */
export function w4RuntimeMetadata(experts: number) {
  if (!Number.isSafeInteger(experts) || experts < 1 || experts > 1000000) throw new Error('Invalid local expert count')
  const strides = [
    ['a_strides1', 'b_strides1'], ['c_strides1', 's_strides13'],
    ['a_strides2', 'b_strides2'], ['c_strides2', 's_strides2'],
  ].map(([name, alias]) => ({ name, aliases: [alias], shape: [experts, 3], dtype: 'INT64', bytes: experts * 3 * 8 }))
  const tensors = [...strides,
    { name: 'expert_offsets', aliases: [], shape: [experts + 1], dtype: 'INT32', bytes: (experts + 1) * 4 },
    ...['problem_sizes1', 'problem_sizes2'].map(name => ({ name, aliases: [], shape: [experts, 3], dtype: 'INT32', bytes: experts * 3 * 4 })),
  ]
  return { tensors, bytes: tensors.reduce((sum, tensor) => sum + tensor.bytes, 0) }
}

export function readW4Stage(params: URLSearchParams, notices: string[]): { w4Stage?: 'processed' } {
  const stage = params.get('w4stage')
  if (stage === 'processed') return { w4Stage: 'processed' }
  if (stage !== null && stage !== 'allocated') notices.push('w4stage 无效，恢复 W4A8 初始分配。')
  return {}
}
