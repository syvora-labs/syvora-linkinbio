import type { JsonLd, SeoMeta } from './types'

export function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

export function metaToHtml(meta: SeoMeta): string {
    const parts: string[] = []
    parts.push(`<title>${escapeHtml(meta.title)}</title>`)
    parts.push(
        `<meta name="description" content="${escapeHtml(meta.description)}">`,
    )
    parts.push(`<link rel="canonical" href="${escapeHtml(meta.canonical)}">`)
    if (meta.robots) {
        parts.push(`<meta name="robots" content="${escapeHtml(meta.robots)}">`)
    }
    for (const tag of meta.tags) {
        parts.push(
            `<meta ${tag.keyAttr}="${escapeHtml(tag.key)}" content="${escapeHtml(
                tag.content,
            )}">`,
        )
    }
    return parts.join('\n    ')
}

export function jsonLdToScriptTag(ld: JsonLd): string {
    // JSON.stringify can emit </script in string values; escape the slash.
    const body = JSON.stringify(ld).replace(/<\//g, '<\\/')
    return `<script type="application/ld+json">${body}</script>`
}

export function renderSeoHead(meta: SeoMeta, jsonLd: JsonLd[]): string {
    const metaHtml = metaToHtml(meta)
    const ldHtml = jsonLd.map(jsonLdToScriptTag).join('\n    ')
    return `${metaHtml}\n    ${ldHtml}`
}
