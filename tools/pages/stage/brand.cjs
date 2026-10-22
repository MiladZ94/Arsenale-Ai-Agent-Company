/* The logo, "Gate": the arched gate of a shipyard read as an A, with one lit
 * bar across the opening. Drawn from shapes, so no font is needed. The source
 * files, the wordmark in outlines and the favicon PNGs are in docs/brand/;
 * these strings must stay the same drawing as docs/brand/arsenale-mark.svg. */
const ARCH = 'M8 58V30A24 24 0 0 1 56 30V58H44V31A12 12 0 0 0 20 31V58Z'

/** The mark as inline SVG, in the ink and the lit green (or white on dark). */
function mark(size, onDark) {
  const ink = onDark ? '#FFFFFF' : '#14212E', lit = onDark ? '#2FD19B' : '#0B8A5F'
  return '<svg class="mark" width="' + size + '" height="' + size + '" viewBox="0 0 64 64" aria-hidden="true"><path fill="' + ink + '" fill-rule="evenodd" d="' + ARCH + '"/><rect x="20" y="40" width="24" height="7" fill="' + lit + '"/></svg>'
}

// docs/brand/favicon.svg, inlined into the page: the page fetches nothing from outside
const FAVICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#14212E"/><g transform="translate(6 4) scale(.82)"><path fill="#FFFFFF" fill-rule="evenodd" d="' + ARCH + '"/><rect x="20" y="40" width="24" height="7" fill="#2FD19B"/></g></svg>'
const FAVICON = 'data:image/svg+xml,' + encodeURIComponent(FAVICON_SVG).replace(/'/g, '%27')

module.exports = { mark, FAVICON, FAVICON_SVG }
