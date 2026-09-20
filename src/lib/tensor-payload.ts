/** Logical operands only. No dtype, allocation, aliasing or peak-memory inference. */
export function tensorPayload(shape: string) {
  const unknown = { elements: null, operands: null, referenceBytes: null }
  // A slash can mean alternatives, separate tensors or views; don't guess its meaning.
  if (!/^\s*\[\s*\d+(?:\s*[×,]\s*\d+)*\s*\](?:\s*\+\s*\[\s*\d+(?:\s*[×,]\s*\d+)*\s*\])*\s*$/.test(shape)) return unknown
  const operands = [...shape.matchAll(/\[([^\]]+)\]/g)].map(match => match[1].split(/[×,]/).map(Number))
  if (operands.flat().some(axis => !Number.isSafeInteger(axis) || axis < 0)) return unknown
  const sizes = operands.map(axes => axes.reduce((product, axis) => product * axis, 1))
  if (sizes.some(size => !Number.isSafeInteger(size))) return unknown
  const elements = sizes.reduce((sum, size) => sum + size, 0)
  if (!Number.isSafeInteger(elements) || !Number.isSafeInteger(elements * 2)) return unknown
  return { elements, operands: operands.length, referenceBytes: elements * 2 }
}
