import DOMPurify from 'dompurify'

/**
 * Clinical notes are stored as HTML produced by the rich text editor, but the
 * column is a free string: anything written through the REST API with a valid
 * token (devtools, a future import, a compromised extension) lands there
 * unchecked. Since the Supabase session and the Google token live in
 * localStorage, an injected script would mean full account takeover — so the
 * HTML is sanitized at RENDER time, which is the only point that is
 * impossible to bypass.
 *
 * The allow-list mirrors what the TipTap editor can actually produce.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'span', 'div',
  'h1', 'h2', 'h3', 'h4',
  'strong', 'b', 'em', 'i', 'u', 's', 'code', 'pre',
  'ul', 'ol', 'li',
  'blockquote', 'hr',
  'a',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
]

const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'colspan', 'rowspan', 'data-type', 'data-checked']

/** Sanitized HTML, safe to hand to dangerouslySetInnerHTML. */
export const sanitizeHtml = (html: string): string =>
  DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Block javascript:/data: URLs; keep the usual safe schemes
    ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel):/i,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
  })

/** Plain-text preview of stored HTML (list snippets, search results). */
export const htmlToText = (html: string): string => {
  const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
  return clean.replace(/\s+/g, ' ').trim()
}
