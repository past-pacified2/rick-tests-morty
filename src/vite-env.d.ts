/**
 * Types this app's own environment variables.
 *
 * Without this, `vite/client` supplies ImportMetaEnv as a bare index signature
 * returning `any`, so every read of import.meta.env is unchecked
 *
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string | undefined;
  readonly VITE_SITE_URL: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
