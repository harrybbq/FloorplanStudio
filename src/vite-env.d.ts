/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Serverless proxy for AI dimension lookup (see src/lib/furniture/providers.ts). */
  readonly VITE_LLM_ENDPOINT?: string;
  /** Serverless proxy for product-page dimension lookup. */
  readonly VITE_SCRAPER_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
