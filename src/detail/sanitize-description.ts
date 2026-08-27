const ALLOWED_TAGS = new Set([
  'A',
  'BR',
  'CODE',
  'EM',
  'LI',
  'OL',
  'P',
  'PRE',
  'STRONG',
  'UL',
])

const REMOVED_TAGS = new Set([
  'EMBED',
  'IFRAME',
  'IMG',
  'MATH',
  'OBJECT',
  'SCRIPT',
  'STYLE',
  'SVG',
])

export function sanitizeDescription(markup: string): string {
  const parsed = new DOMParser().parseFromString(markup, 'text/html')

  for (const element of Array.from(parsed.body.querySelectorAll('*'))) {
    if (REMOVED_TAGS.has(element.tagName)) {
      element.remove()
      continue
    }

    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes))
      continue
    }

    const href = element.tagName === 'A' ? element.getAttribute('href') : null

    for (const attribute of Array.from(element.attributes)) {
      element.removeAttribute(attribute.name)
    }

    if (
      element.tagName === 'A' &&
      href !== null &&
      /^(https?:|mailto:|\/|#)/i.test(href)
    ) {
      element.setAttribute('href', href)
      element.setAttribute('rel', 'noreferrer')
    }
  }

  return parsed.body.innerHTML
}
