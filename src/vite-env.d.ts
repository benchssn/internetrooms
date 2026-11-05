/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://abcd1234.supabase.co */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable (browser-safe) key, sb_publishable_… */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
