export interface SeoEvent {
    id: string
    title: string
    artwork_url: string
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
