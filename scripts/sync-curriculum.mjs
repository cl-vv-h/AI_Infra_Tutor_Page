import { access, cp, mkdir } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const defaultTutorPath = resolve(projectRoot, '../sglang_tutor')
const tutorPath = resolve(process.env.SGLANG_TUTOR_PATH ?? process.argv[2] ?? defaultTutorPath)
const learningPath = resolve(tutorPath, 'learning')
const targetPath = resolve(projectRoot, 'src/data/content')
const supportedExtensions = new Set(['.md', '.py', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif'])

await access(resolve(learningPath, 'zh/README.md'))
await access(resolve(learningPath, 'en/README.md'))
await mkdir(targetPath, { recursive: true })

for (const language of ['zh', 'en']) {
  await cp(resolve(learningPath, language), resolve(targetPath, language), {
    recursive: true,
    force: true,
    filter: (source) => !extname(source) || supportedExtensions.has(extname(source).toLowerCase()),
  })
}

console.log(`Curriculum synced from ${tutorPath}.`)
