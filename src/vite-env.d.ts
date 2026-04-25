/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GOOGLE_CALENDAR_API_KEY: string
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_APP_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.css'
declare module '*.svg' {
  const content: string
  export default content
}
