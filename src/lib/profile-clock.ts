/** Keep sub-microsecond tasks when CANN emits epoch timestamps as decimal strings.
 * Subtract an integral second BEFORE converting the fractional part to Number.
 * Numeric JSON timestamps may already have lost precision; never invent it back.
 */
export function profileClockBase(values: Iterable<unknown>, scale = 1): number {
  let first = Infinity
  for (const value of values) {
    const decimal=typeof value==='string'&&/^\d+(?:\.\d*)?$/.test(value.trim())
    // Floor the integer part before conversion: Number may round .999999 up
    // across a second boundary at epoch magnitude.
    const whole=decimal?BigInt(value.trim().split('.')[0]):0n
    const n = decimal&&(scale===1||scale===.001)
      ? Number(whole/(scale===1?1000000n:1000000000n))*1e6
      : Number(value) * scale
    if (value !== '' && value !== null && value !== undefined && Number.isFinite(n) && n >= 0) first = Math.min(first, n)
  }
  return first >= 1e12 && Number.isFinite(first) ? Math.floor(first / 1e6) * 1e6 : 0
}

export function profileTimestamp(value: unknown, scale: number, base: number): number | undefined {
  const s = String(value ?? '').trim()
  if (!s || !/^[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) return undefined
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0 || n * scale > Number.MAX_SAFE_INTEGER) return undefined
  if (base && typeof value === 'string' && /^\d+(?:\.\d*)?$/.test(s)) {
    const [whole, fraction = ''] = s.split('.')
    if (scale === 1) return Number(BigInt(whole) - BigInt(base)) + Number(`0.${fraction || '0'}`)
    if (scale === .001) {
      const ns = BigInt(whole)
      return Number(ns / 1000n - BigInt(base)) + Number(ns % 1000n) / 1000 + Number(`0.${fraction || '0'}`) / 1000
    }
  }
  return n * scale - base
}
