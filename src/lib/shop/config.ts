// Public-shop configuration. The mandator id scopes every catalogue query —
// the anon key has SELECT access via permissive RLS but does NOT filter by
// tenant, so this filter is our responsibility (see the integration guide).
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
export const MANDATOR_ID = import.meta.env.VITE_MANDATOR_ID as string
