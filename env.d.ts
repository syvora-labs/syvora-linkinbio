/// <reference types="vite/client" />
interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
    readonly VITE_TOKEN_ADDRESS: string
    readonly VITE_VAULT_ADDRESS: string
    readonly VITE_CHAIN_ID: string
    readonly VITE_LOCAL_SETUP_NOTICE: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
