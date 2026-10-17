// Group the card files by kind. File names decide the kind (see docs/content-spec.md).
export function assembleContent(files) {
  const out = { subjects: [], wheres: [], whens: [], twists: [], themes: [], lines: {}, tips: {}, palettes: {} }
  const names = Object.keys(files).sort()
  for (const path of names) {
    const name = path.split('/').pop()
    const data = files[path]
    if (/^(fur|leaf|hearth)\b/.test(name)) out.subjects.push(...data)
    else if (/^where\b/.test(name)) out.wheres.push(...data)
    else if (/^when\b/.test(name)) out.whens.push(...data)
    else if (/^twists?\b/.test(name)) out.twists.push(...data)
    else if (/^themes?\b/.test(name)) out.themes.push(...data)
    else if (/^lines\b/.test(name)) out.lines = data
    else if (/^tips\b/.test(name)) out.tips = data
    else if (/^palettes\b/.test(name)) out.palettes = data
  }
  return out
}
