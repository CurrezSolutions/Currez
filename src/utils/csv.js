// Minimal RFC 4180 CSV serializer — escapes a value containing a comma,
// quote or newline by wrapping it in quotes and doubling any inner quotes.
function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

// `columns` is `[{ label, value(row) }, ...]` — keeps the export shape
// declared next to the button that triggers it, rather than baked in here.
export function toCsv(rows, columns) {
  const header = columns.map((c) => csvEscape(c.label)).join(',')
  const lines = rows.map((row) => columns.map((c) => csvEscape(c.value(row))).join(','))
  return [header, ...lines].join('\r\n')
}

export function downloadCsv(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
