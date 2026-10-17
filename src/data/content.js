// All card content, bundled at build time.
import { assembleContent } from './assemble.js'
import { indexContent } from '../engine/reading.js'
import pencilList from './pencils.json'
import sets from './sets.json'

const files = import.meta.glob('./cards/*.json', { eager: true, import: 'default' })

export const content = indexContent(assembleContent(files))
export const pencils = pencilList
export const pencilSets = sets
export const pencilByCode = new Map(pencilList.map((p) => [p.code, p]))
