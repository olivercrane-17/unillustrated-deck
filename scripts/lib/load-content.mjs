// Node-side loader for scripts: same shape as src/data/content.js.
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assembleContent } from '../../src/data/assemble.js'
import { indexContent } from '../../src/engine/reading.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'))

export function loadAll() {
  const dir = join(ROOT, 'src/data/cards')
  const files = {}
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) files[f] = JSON.parse(readFileSync(join(dir, f), 'utf8'))
  return {
    content: indexContent(assembleContent(files)),
    pencils: read('src/data/pencils.json'),
    sets: read('src/data/sets.json'),
  }
}
