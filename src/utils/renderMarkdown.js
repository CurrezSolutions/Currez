// Lightweight markdown → HTML for doctor bios.
// Supports: headings, bold, italic, inline code, links, unordered/ordered lists,
// blockquotes, horizontal rules, and paragraphs. No external deps.
export function renderMarkdown(md) {
  if (!md) return ''

  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const html = []
  let inList = false
  let listType = ''
  let inBlockquote = false

  function closeList() {
    if (inList) {
      html.push(listType === 'ol' ? '</ol>' : '</ul>')
      inList = false
    }
  }
  function closeBlockquote() {
    if (inBlockquote) {
      html.push('</blockquote>')
      inBlockquote = false
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    // blank line — close open blocks
    if (line.trim() === '') {
      closeList()
      closeBlockquote()
      continue
    }

    // horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      closeList()
      closeBlockquote()
      html.push('<hr/>')
      continue
    }

    // headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      closeList()
      closeBlockquote()
      const level = headingMatch[1].length
      html.push(`<h${level}>${inlineMd(headingMatch[2])}</h${level}>`)
      continue
    }

    // unordered list
    if (/^[\s]*[-*+]\s+/.test(line)) {
      closeBlockquote()
      if (!inList || listType !== 'ul') {
        closeList()
        html.push('<ul>')
        inList = true
        listType = 'ul'
      }
      html.push(`<li>${inlineMd(line.replace(/^[\s]*[-*+]\s+/, ''))}</li>`)
      continue
    }

    // ordered list
    if (/^[\s]*\d+\.\s+/.test(line)) {
      closeBlockquote()
      if (!inList || listType !== 'ol') {
        closeList()
        html.push('<ol>')
        inList = true
        listType = 'ol'
      }
      html.push(`<li>${inlineMd(line.replace(/^[\s]*\d+\.\s+/, ''))}</li>`)
      continue
    }

    // blockquote
    if (/^>\s?/.test(line)) {
      closeList()
      if (!inBlockquote) {
        html.push('<blockquote>')
        inBlockquote = true
      }
      html.push(`<p>${inlineMd(line.replace(/^>\s?/, ''))}</p>`)
      continue
    }

    // paragraph
    closeList()
    closeBlockquote()
    html.push(`<p>${inlineMd(line)}</p>`)
  }

  closeList()
  closeBlockquote()
  return html.join('\n')
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Only http(s)/mailto/tel and scheme-less (relative or #anchor) links are
// ever emitted as an href — blocks a javascript:/data: URI smuggled through
// otherwise-valid `[label](url)` syntax from executing on click.
function isSafeUrl(url) {
  if (/^(https?:|mailto:|tel:)/i.test(url)) return true
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return false
  return true
}

function inlineMd(text) {
  // Escape first, on the raw text — markdown's own syntax characters
  // (*_`[]()) aren't HTML-special so this can't interfere with the
  // replacements below, but it does stop literal <script>/<img onerror=...>
  // (or anything else HTML-shaped) typed straight into the source from ever
  // reaching dangerouslySetInnerHTML unescaped. See DoctorProfilePage.jsx,
  // the public, unauthenticated render site this exists to protect.
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
      const trimmedUrl = url.trim()
      return isSafeUrl(trimmedUrl)
        ? `<a href="${trimmedUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`
        : label
    })
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
}
