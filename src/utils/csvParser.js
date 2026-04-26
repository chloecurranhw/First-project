export function parseCSVText(text) {
  const firstLine = text.split('\n')[0] || ''
  const delimiter = firstLine.split(';').length > firstLine.split(',').length ? ';' : ','

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (!lines.length) return { headers: [], rows: [] }

  const parseRow = line => {
    const result = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQuotes = !inQuotes
      } else if (ch === delimiter && !inQuotes) {
        result.push(cur.trim().replace(/^"|"$/g, ''))
        cur = ''
      } else {
        cur += ch
      }
    }
    result.push(cur.trim().replace(/^"|"$/g, ''))
    return result
  }

  const headers = parseRow(lines[0])
  const rows = lines.slice(1).map(line => {
    const vals = parseRow(line)
    return headers.reduce((obj, h, i) => ({ ...obj, [h]: vals[i] ?? '' }), {})
  }).filter(r => Object.values(r).some(v => String(v).trim()))

  return { headers, rows }
}
