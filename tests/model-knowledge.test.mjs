import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { modelKnowledge, knowledgeGroups, modelNotation } from '../src/data/model-knowledge.ts'
import { categories } from '../src/data/categories.ts'
import { modelArchitectures } from '../src/data/models.ts'
import { parseExplorer } from '../src/lib/model-explorer.ts'
import { parseDpa } from '../src/lib/dpa-lab.ts'
import { parseV41Scenario } from '../src/lib/deepseek-v41-reference.ts'
import { learningStops } from '../src/lib/model-learning.ts'
import { selectV41Lesson, v41LessonContent } from '../src/lib/v41-learning.ts'
import { newsStudyGuides } from '../src/data/news-study-guides.ts'
import { newsLearningConcepts } from '../src/data/news-learning.ts'

test('knowledge system has ordered, acyclic prerequisites and concise declarative content', () => {
  assert.equal(modelKnowledge.length, 9)
  assert.equal(new Set(modelKnowledge.map(t => t.id)).size, 9)
  assert.equal(modelNotation.length, 8)
  for (const group of knowledgeGroups) assert.equal(modelKnowledge.filter(t => t.group === group.id).length, 3)
  const prior = new Set()
  for (const topic of modelKnowledge) {
    for (const prerequisite of topic.prerequisites) assert.ok(prior.has(prerequisite), `${topic.id}: prerequisite must precede topic`)
    prior.add(topic.id)
    assert.equal(topic.concepts.length, 3)
    assert.ok(topic.examples.length && topic.readings.length)
    for (const concept of topic.concepts) {
      assert.ok(concept.body.length > 15 && concept.body.length < 150)
      assert.ok(concept.expression.length && concept.scope.length)
    }
    assert.doesNotMatch(JSON.stringify(topic), /？|先预测|揭示答案|查看本步讲解|阅读任务/)
  }
})

test('every knowledge link resolves to a real course or valid numerical experiment', () => {
  const articles = JSON.parse(readFileSync(new URL('../src/data/curriculum-index.json', import.meta.url)))
  for (const topic of modelKnowledge) for (const link of [...topic.examples, ...topic.readings]) {
    const url = new URL(link.to, 'https://example.org')
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts[0] === 'category') assert.ok(categories.some(c => c.slug === parts[1]), link.to)
    else if (parts[0] === 'article') assert.ok(articles.some(a => a.slug === parts[1]), link.to)
    else if (parts[1] === 'compare') continue
    else if (parts[1] === 'deepseek-v4-1-flash') assert.deepEqual(parseV41Scenario(url.searchParams).notices, [])
    else if (parts[2] === 'dpa') assert.deepEqual(parseDpa(url.searchParams, parts[1]).notices, [])
    else {
      const model = modelArchitectures.find(m => m.id === parts[1])
      assert.ok(model, link.to)
      assert.deepEqual(parseExplorer(url.searchParams, model).notices, [], link.to)
    }
  }
})

test('module knowledge and all V4.1 topics contain facts without question/answer fields', () => {
  for (const model of modelArchitectures) for (let layer = 0; layer < model.dimensions.layers; layer++) {
    for (const stop of learningStops(model, layer)) {
      assert.ok(stop.focus)
      assert.equal('question' in stop, false)
      assert.doesNotMatch(stop.focus + stop.context + stop.node.description, /？|先预测|揭示答案/)
    }
  }
  const state = parseV41Scenario(new URLSearchParams('world=8&rank=7')).state
  for (let i = 0; i < 8; i++) {
    const topic = v41LessonContent(selectV41Lesson(state, i))
    assert.ok(topic.heading && topic.description)
    assert.equal('question' in topic || 'answer' in topic, false)
    assert.doesNotMatch(topic.heading + topic.description, /？|先预测|揭示答案/)
  }
})

test('curated news context uses declarative concepts instead of reading questions', () => {
  for (const guide of Object.values(newsStudyGuides)) {
    assert.equal(guide.points.length, 3)
    assert.doesNotMatch(guide.points.join(''), /？|答案/)
    assert.equal('questions' in guide, false)
  }
  for (const concept of newsLearningConcepts) {
    assert.ok(concept.description)
    assert.doesNotMatch(concept.description, /？|答案/)
    assert.equal('question' in concept, false)
  }
})
