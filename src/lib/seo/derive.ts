import { SITE_ORIGIN } from './types'

export function extractCity(location: string): string {
    if (!location) return ''
    const [first] = location.split(',')
    return first.trim()
}

/**
 * Truncate `text` so the result is at most `max` characters, including the
 * trailing ellipsis (…). Prefers a word boundary within the last 10 chars
 * before the cap. Returns the input unchanged when it already fits.
 *
 * Guarantees: result.length <= max.
 */
export function truncate(text: string, max: number): string {
    if (text.length <= max) return text
    const hard = max - 1 // leave room for '…'
    const soft = Math.max(hard - 10, 1)
    const window = text.slice(0, hard)
    const lastSpace = window.lastIndexOf(' ')
    const cut = lastSpace >= soft ? lastSpace : hard
    return text.slice(0, cut).trimEnd() + '…'
}

export function formatEventDateLong(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
    })
}

export function formatEventDateShort(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
    })
}

export function absoluteUrl(pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
    if (pathOrUrl.startsWith('/')) return SITE_ORIGIN + pathOrUrl
    return `${SITE_ORIGIN}/${pathOrUrl}`
}
