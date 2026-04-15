import type { SeoEvent } from './types'

const EVENT_COLUMNS = 'id,title,artwork_url,location,event_date,ticket_link'

interface EdgeSupabaseEnv {
    url: string
    anonKey: string
}

function readEnv(): EdgeSupabaseEnv | null {
    // Vercel Edge runtime exposes env vars on the global `process.env`
    // shim. Fall back to globalThis for other shapes.
    const env =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (typeof process !== 'undefined' ? (process as any).env : undefined) ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).env
    if (!env) return null
    const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL
    const anonKey = env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY
    if (!url || !anonKey) return null
    return { url, anonKey }
}

async function restGet(path: string): Promise<unknown> {
    const env = readEnv()
    if (!env) throw new Error('Supabase env missing on edge')
    const res = await fetch(`${env.url}/rest/v1/${path}`, {
        headers: {
            apikey: env.anonKey,
            authorization: `Bearer ${env.anonKey}`,
            accept: 'application/json',
        },
    })
    if (!res.ok) throw new Error(`Supabase REST ${res.status}`)
    return res.json()
}

export async function fetchEventById(id: string): Promise<SeoEvent | null> {
    // PostgREST filter syntax; .single not used — we want null on 0 rows.
    const rows = (await restGet(
        `events?select=${EVENT_COLUMNS}&id=eq.${encodeURIComponent(
            id,
        )}&is_draft=eq.false&is_archived=eq.false&limit=1`,
    )) as SeoEvent[]
    return rows[0] ?? null
}

export async function fetchUpcomingEvents(limit = 10): Promise<SeoEvent[]> {
    const nowIso = new Date().toISOString()
    return (await restGet(
        `events?select=${EVENT_COLUMNS}&is_draft=eq.false&is_archived=eq.false&event_date=gte.${encodeURIComponent(
            nowIso,
        )}&order=event_date.asc&limit=${limit}`,
    )) as SeoEvent[]
}

export async function fetchRecentAndUpcomingEvents(): Promise<SeoEvent[]> {
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - 6)
    return (await restGet(
        `events?select=${EVENT_COLUMNS}&is_draft=eq.false&is_archived=eq.false&event_date=gte.${encodeURIComponent(
            cutoff.toISOString(),
        )}&order=event_date.asc`,
    )) as SeoEvent[]
}
