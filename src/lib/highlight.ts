// Parts of a text that match a search, ignoring case and accents ("cafe" finds "Café"), for bolding
// them in results. Each part keeps the original characters.
export interface TextPart {
  text: string
  match: boolean
}

const MARKS = /\p{M}/gu

// Each character folded (no accents, lower case), with the index of the original character it came from.
function fold(text: string) {
  let folded = ''
  const origin: number[] = []
  Array.from(text).forEach((char, index) => {
    const plain = char.normalize('NFD').replace(MARKS, '').toLowerCase()
    folded += plain
    for (let i = 0; i < plain.length; i++) {
      origin.push(index)
    }
  })
  return { folded, origin }
}

export function highlightParts(text: string, query: string): TextPart[] {
  const needle = fold(query.trim()).folded
  if (needle === '' || text === '') {
    return [{ text, match: false }]
  }
  const chars = Array.from(text)
  const { folded, origin } = fold(text)
  const parts: TextPart[] = []
  let cursor = 0
  for (let at = folded.indexOf(needle); at >= 0; at = folded.indexOf(needle, at + needle.length)) {
    const start = origin[at]
    let end = origin[at + needle.length - 1] + 1
    // A combining accent that follows stays with its letter.
    while (end < chars.length && chars[end].replace(MARKS, '') === '') {
      end++
    }
    if (start > cursor) {
      parts.push({ text: chars.slice(cursor, start).join(''), match: false })
    }
    parts.push({ text: chars.slice(start, end).join(''), match: true })
    cursor = end
  }
  if (cursor < chars.length) {
    parts.push({ text: chars.slice(cursor).join(''), match: false })
  }
  return parts
}
