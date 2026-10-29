import type { FurnitureDimensions, FurnitureSource } from '../../types';
import { matchCatalog } from './sampleCatalog';

/**
 * FurnitureProvider — the swap point for furniture-dimension lookups.
 *
 * The registry asks providers in order and returns the first hit. The UI
 * always routes a hit through the "confirm dimensions" step, so estimated
 * results are shown (and editable) before anything is placed. Adding a
 * provider is a change here only — no UI changes needed.
 *
 * Shipping in this build:
 *   - Catalog: a small built-in catalog of common products (offline).
 *
 * Ready to enable (each needs a backend endpoint — an API key must never live
 * in this client-side build, so they call a serverless proxy you host):
 *   - AI lookup  (VITE_LLM_ENDPOINT)     — proxy asks an LLM for the dimensions
 *   - Web lookup (VITE_SCRAPER_ENDPOINT) — proxy scrapes a product page
 */
export interface FurnitureProvider {
  readonly label: string;
  /** Return null if this provider can't answer the query. */
  lookup(query: string): Promise<FurnitureDimensions | null>;
}

const catalogProvider: FurnitureProvider = {
  label: 'Catalog',
  async lookup(query) {
    const entry = matchCatalog(query);
    if (!entry) return null;
    const { name, widthMm, depthMm, heightMm } = entry;
    return { name, widthMm, depthMm, heightMm, source: 'catalog', confidence: 'estimated' };
  },
};

const TIMEOUT_MS = 8000;
const MAX_REASONABLE_MM = 20_000;
const isLength = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v < MAX_REASONABLE_MM;

/**
 * Calls a serverless proxy that returns a product's dimensions.
 * Inert (returns null) when no endpoint is configured.
 *
 * Contract:  POST <endpoint> { "query": string }
 *            200 → { "name"?: string, "widthMm": number, "depthMm": number, "heightMm"?: number }
 */
class EndpointProvider implements FurnitureProvider {
  constructor(
    readonly label: string,
    private readonly source: FurnitureSource,
    private readonly endpoint: string | undefined
  ) {}

  async lookup(query: string): Promise<FurnitureDimensions | null> {
    if (!this.endpoint) return null;
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!isLength(data?.widthMm) || !isLength(data?.depthMm)) return null;
      return {
        name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : query,
        widthMm: data.widthMm,
        depthMm: data.depthMm,
        heightMm: isLength(data.heightMm) ? data.heightMm : 0,
        source: this.source,
        confidence: 'estimated',
      };
    } catch {
      return null; // network error, timeout or bad JSON — let the next provider try
    }
  }
}

class ProviderRegistry {
  constructor(private readonly providers: FurnitureProvider[]) {}

  async lookup(query: string): Promise<FurnitureDimensions | null> {
    for (const p of this.providers) {
      const result = await p.lookup(query);
      if (result) return result;
    }
    return null;
  }
}

// Order = preference: free/offline first, then remote.
export const defaultRegistry = new ProviderRegistry([
  catalogProvider,
  new EndpointProvider('AI lookup', 'llm', import.meta.env.VITE_LLM_ENDPOINT),
  new EndpointProvider('Web lookup', 'scraper', import.meta.env.VITE_SCRAPER_ENDPOINT),
]);
