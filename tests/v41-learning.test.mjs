import test from 'node:test'
import assert from 'node:assert/strict'
import { parseV41Scenario, v41Params } from '../src/lib/deepseek-v41-reference.ts'
import { selectV41Lesson, v41LessonContent, v41Lessons } from '../src/lib/v41-learning.ts'

const read = (q = '') => parseV41Scenario(new URLSearchParams(q)).state
test('V4.1 lessons preserve all numerical conditions and navigate to concrete reference workspaces', () => {
  const initial = read('world=8&replicas=4&rank=31&b=3&s=16385&phase=prefill&storage=packed&weights=4')
  const views = ['diagram', 'diagram', 'diagram', 'weights', 'weights', 'weights', 'cache', 'weights']
  const layers = [0, 24, 20, 20, 20, 14, 24, 14]
  assert.equal(v41Lessons.length, 8)
  for (let lesson = 0; lesson < 8; lesson++) {
    const state = selectV41Lesson(initial, lesson)
    assert.equal(state.layer, layers[lesson])
    assert.equal(state.view, views[lesson])
    assert.equal(state.lesson, lesson)
    for (const key of ['world', 'replicas', 'rank', 'batch', 'sequence', 'phase', 'storage', 'weightMode']) assert.equal(state[key], initial[key])
    assert.deepEqual(parseV41Scenario(v41Params(state)).state, state)
    const content = v41LessonContent(state)
    assert.ok(content.question.length > 0 && content.answer.length > 0)
    assert.doesNotMatch(content.answer, /NaN|undefined|Infinity/)
  }
  for (const value of [-1, 8, 1.5, NaN]) {
    assert.throws(() => selectV41Lesson(initial, value), /Invalid/)
    assert.throws(() => v41LessonContent({ ...initial, lesson: value }), /Invalid/)
  }
})
test('V4.1 lesson answers follow current rank, phase, ownership and format rather than static defaults', () => {
  assert.match(v41LessonContent(read('lesson=0&b=3&s=5&phase=prefill')).answer, /N=15/)
  assert.match(v41LessonContent(read('lesson=0&b=3&s=5&phase=decode')).answer, /N=3，/)
  const source = v41LessonContent(read('lesson=1&layer=24')).answer
  assert.match(source, /主 KV：Layer 20；Index K：Layer 20；Top-k：Layer 24/)
  assert.match(v41LessonContent(read('lesson=1&layer=0')).answer, /主 KV：不使用/)
  assert.match(v41LessonContent(read('lesson=2&layer=0')).answer, /初始 one-hot/)
  assert.match(v41LessonContent(read('lesson=3&world=8&replicas=4&rank=31')).answer, /heads 56–63/)
  assert.match(v41LessonContent(read('lesson=3&world=8&replicas=4&rank=31')).answer, /\[24, 25, 26, 27, 28, 29, 30, 31\]/)
  assert.match(v41LessonContent(read('lesson=4&world=8&rank=7')).answer, /专家 336–383，中间维仍是 2304/)
  assert.match(v41LessonContent(read('lesson=5&layer=14&world=8&rank=7')).answer, /6 行 padding/)
  assert.match(v41LessonContent(read('lesson=5&layer=14&world=8&rank=0')).answer, /0 行 padding/)
  assert.match(v41LessonContent(read('lesson=5&layer=0')).answer, /当前层没有 Engram/)
  assert.match(v41LessonContent(read('lesson=6&s=4096&storage=packed')).answer, /6,373,376 B/)
  assert.match(v41LessonContent(read('lesson=6&s=4096&storage=reference')).answer, /18,374,656 B/)
  assert.match(v41LessonContent(read('lesson=7&weights=4')).answer, /统一 4-bit 理论载荷/)
  assert.match(v41LessonContent(read('lesson=7&weights=native')).answer, /参考混合格式（含 scale）/)
})
