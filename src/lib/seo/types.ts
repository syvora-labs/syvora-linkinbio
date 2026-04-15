export interface SeoEvent {
    id: string
    title: string
    /**
     * Promo artwork URL. May be null for events with no external promo
     * (typically internally-managed ticket sales) — consumers must fall
     * back to a default image.
     */
    artwork_url: string | null
    location: string
    event_date: string // ISO 8601
    ticket_link: string | null
}

export interface MetaTag {
    /** 'name' for <meta name="..."> or 'property' for <meta property="..."> */
    keyAttr: 'name' | 'property'
    key: string
    content: string
}

export interface SeoMeta {
    title: string
    description: string
    canonical: string
    robots?: string
    tags: MetaTag[]
}

export type JsonLd = Record<string, unknown>

export const SITE_ORIGIN = 'https://eclipseboundaries.ch'
export const SITE_NAME = 'ECLIPSE BOUNDARIES'
