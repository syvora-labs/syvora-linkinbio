import {
    absoluteUrl,
    extractCity,
    formatEventDateLong,
    formatEventDateShort,
    truncate,
} from './derive'
import {
    SITE_NAME,
    SITE_ORIGIN,
    type JsonLd,
    type MetaTag,
    type SeoEvent,
    type SeoMeta,
} from './types'

const HOME_TITLE = `${SITE_NAME} — House Music Label in Lucerne`
const HOME_DESCRIPTION =
    `${SITE_NAME} is a house music label presenting underground events in Lucerne and beyond. Upcoming shows, tickets, radios, mixes.`
const HOME_OG_IMAGE = `${SITE_ORIGIN}/og-default.jpg`

const MAX_TITLE = 60
const MAX_DESCRIPTION = 155
const MAX_OG_DESCRIPTION = 200

export function buildHomeMeta(): SeoMeta {
    const title = truncate(HOME_TITLE, MAX_TITLE)
    const description = truncate(HOME_DESCRIPTION, MAX_DESCRIPTION)
    const ogDescription = truncate(
        'Electronic events in Lucerne & Switzerland.',
        MAX_OG_DESCRIPTION,
    )
    return {
        title,
        description,
        canonical: `${SITE_ORIGIN}/`,
        tags: [
            { keyAttr: 'property', key: 'og:type', content: 'website' },
            { keyAttr: 'property', key: 'og:site_name', content: SITE_NAME },
            { keyAttr: 'property', key: 'og:title', content: SITE_NAME },
            { keyAttr: 'property', key: 'og:description', content: ogDescription },
            { keyAttr: 'property', key: 'og:url', content: `${SITE_ORIGIN}/` },
            { keyAttr: 'property', key: 'og:image', content: HOME_OG_IMAGE },
            { keyAttr: 'property', key: 'og:locale', content: 'en_US' },
            { keyAttr: 'name', key: 'twitter:card', content: 'summary_large_image' },
            { keyAttr: 'name', key: 'twitter:title', content: SITE_NAME },
            { keyAttr: 'name', key: 'twitter:description', content: ogDescription },
            { keyAttr: 'name', key: 'twitter:image', content: HOME_OG_IMAGE },
        ],
    }
}

export function buildEventMeta(event: SeoEvent): SeoMeta {
    const city = extractCity(event.location) || event.location
    const dateShort = formatEventDateShort(event.event_date)
    const dateLong = formatEventDateLong(event.event_date)
    const canonical = `${SITE_ORIGIN}/event/${event.id}`
    const ogImage = absoluteUrl(event.artwork_url)

    const titleSuffix = ` — ${city}, ${dateShort} | ${SITE_NAME}`
    const maxEventTitle = MAX_TITLE - titleSuffix.length
    const title =
        maxEventTitle > 1
            ? truncate(event.title, maxEventTitle) + titleSuffix
            : truncate(event.title + titleSuffix, MAX_TITLE)
    const description = truncate(
        `${event.title} live on ${dateLong} at ${event.location}. Electronic music presented by ${SITE_NAME}. Tickets available now.`,
        MAX_DESCRIPTION,
    )
    const ogDescription = truncate(
        `${event.title} on ${dateLong} at ${event.location}. Tickets available now.`,
        MAX_OG_DESCRIPTION,
    )
    const ogTitle = truncate(`${event.title} — ${city}, ${dateShort}`, MAX_TITLE)

    const tags: MetaTag[] = [
        { keyAttr: 'property', key: 'og:type', content: 'website' },
        { keyAttr: 'property', key: 'og:site_name', content: SITE_NAME },
        { keyAttr: 'property', key: 'og:title', content: ogTitle },
        { keyAttr: 'property', key: 'og:description', content: ogDescription },
        { keyAttr: 'property', key: 'og:url', content: canonical },
        { keyAttr: 'property', key: 'og:image', content: ogImage },
        { keyAttr: 'property', key: 'og:locale', content: 'en_US' },
        { keyAttr: 'name', key: 'twitter:card', content: 'summary_large_image' },
        { keyAttr: 'name', key: 'twitter:title', content: ogTitle },
        { keyAttr: 'name', key: 'twitter:description', content: ogDescription },
        { keyAttr: 'name', key: 'twitter:image', content: ogImage },
    ]

    return { title, description, canonical, tags }
}

const SOCIAL_LINKS = [
    'https://www.instagram.com/eclipse_boundaries/',
    'https://www.youtube.com/@eclipse_boundaries',
    'https://tiktok.com/@eclipse_boundaries',
]

const GENRES = ['Electronic', 'House', 'Drum and Bass']

export function buildEventJsonLd(event: SeoEvent): JsonLd {
    const city = extractCity(event.location) || event.location
    const canonical = `${SITE_ORIGIN}/event/${event.id}`
    const ticketUrl = event.ticket_link ?? `${canonical}/tickets`
    const ogImage = absoluteUrl(event.artwork_url)
    return {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: event.title,
        startDate: event.event_date,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: {
            '@type': 'Place',
            name: event.location,
            address: {
                '@type': 'PostalAddress',
                addressLocality: city,
                addressCountry: 'CH',
            },
        },
        image: [ogImage],
        organizer: {
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_ORIGIN,
        },
        offers: {
            '@type': 'Offer',
            url: ticketUrl,
            availability: 'https://schema.org/InStock',
            validFrom: new Date().toISOString(),
        },
        url: canonical,
    }
}

export function buildMusicGroupJsonLd(events: SeoEvent[]): JsonLd {
    return {
        '@context': 'https://schema.org',
        '@type': 'MusicGroup',
        name: SITE_NAME,
        url: SITE_ORIGIN,
        genre: GENRES,
        sameAs: SOCIAL_LINKS,
        event: events.map((e) => {
            const ld = buildEventJsonLd(e) as Record<string, unknown>
            // strip redundant @context inside nested items
            const { ['@context']: _ctx, ...rest } = ld
            return rest
        }),
    }
}

export function buildBreadcrumbJsonLd(event: SeoEvent): JsonLd {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: `${SITE_ORIGIN}/`,
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: event.title,
                item: `${SITE_ORIGIN}/event/${event.id}`,
            },
        ],
    }
}
