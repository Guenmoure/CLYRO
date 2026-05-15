/**
 * Decode a curated whitelist of HTML entities to their Unicode
 * equivalents. Used as a safer drop-in replacement for the
 * `dangerouslySetInnerHTML={{ __html: ... }}` pattern that was sprinkled
 * across the `(public)/resources/*` and `(public)/legal/contact` pages
 * just to render typographic entities like `&rsquo;` and `&hellip;`.
 *
 * Returns plain text. React then escapes the output automatically when
 * you embed it as a child (`{decodeEntities(s)}`), so there's zero
 * markup-injection surface — even if `s` ever turns out to come from an
 * untrusted source.
 *
 * The whitelist covers entities actually present in the codebase. Add
 * to it only when needed; never expand it to include angle brackets or
 * any structural HTML — that would re-open the XSS vector this utility
 * exists to close.
 *
 * If a string genuinely needs structural HTML (e.g. <strong> in a
 * marketing line), parse it with a real sanitizer (`rehype-sanitize`)
 * rather than extending this function.
 */
export function decodeEntities(input: string): string {
  if (!input) return ''
  return input
    .replace(/&rsquo;/g, '’')   // ’ right single quote
    .replace(/&lsquo;/g, '‘')   // ‘ left single quote
    .replace(/&rdquo;/g, '”')   // ” right double quote
    .replace(/&ldquo;/g, '“')   // “ left double quote
    .replace(/&hellip;/g, '…')  // … horizontal ellipsis
    .replace(/&nbsp;/g, ' ')    //   non-breaking space
    .replace(/&mdash;/g, '—')   // — em dash
    .replace(/&ndash;/g, '–')   // – en dash
    .replace(/&times;/g, '×')   // × multiplication
    .replace(/&laquo;/g, '«')   // « French left quote
    .replace(/&raquo;/g, '»')   // » French right quote
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')           // run last so &amp;hellip; doesn't decode twice
}
