import type { FurnitureDimensions } from '../../types';
import { matchCatalog } from './sampleCatalog';

/**
 * FurnitureProvider — the swap point for furniture-dimension lookups.
 *
 * The registry walks providers in order and returns the first non-null hit.
 * The calling UI always routes a hit through a "confirm dimensions" modal, so
 * estimated results are surfaced (and editable) before anything is placed.
 * Adding a provider is a one-file change here — no UI changes required.
 *
 * Shipping in this build:
 *   - SampleProvider — a tiny built-in catalog of well-known products (works
 *     offline; illustrative sample data marked 'estimated').
 *   - ManualProvider — always returns null → UI falls through to manual entry.
 *
 * Ready to enable (need a backend endpoint — an API key must NOT live in this
 * client-side build, so these call a serverless proxy you host):
 *   - LLMProvider     — POSTs the query to your endpoint, which asks an LLM.
 *   - ScraperProvider — POSTs the query/URL to your endpoint, which scrapes a
 *     product page (browsers can't scrape cross-origin directly — CORS).
 */
export interface FurnitureProvider {
  readonly id: string;
  readonly label: string;
  /** Return null if this provider can't satisfy the query. */
  lookup(query: string): Promise<FurnitureDimensions | null>;
}

/** Built-in sample catalog. Offline, no config. Marks results 'estimated'. */
export class SampleProvider implements FurnitureProvider {
  readonly id = 'catalog';
  readonly label = 'Sample catalog';
  async lookup(query: string): Promise<FurnitureDimensions | null> {
    const entry = matchCatalog(query);
    if (!entry) return null;
    return {
      name: entry.name,
      widthMm: entry.widthMm,
      depthMm: entry.depthMm,
      heightMm: entry.heightMm,
      source: 'catalog',
      confidence: 'estimated',
    };
  }
}

/**
 * Asks an LLM (via your serverless proxy) for a product's dimensions.
 * Inert until an endpoint is provided — returns null so the registry moves on.
 *
 * Expected endpoint contract:
 *   POST <endpoint>  { "query": string }
 *   200 -> { "name"?: string, "widthMm": number, "depthMm": number, "heightMm"?: number }
 */
export class LLMProvider implements FurnitureProvider {
  readonly id = 'llm';
  readonly label = 'AI lookup';
  constructor(private readonly endpoint?: string) {}
  async lookup(query: string): Promise<FurnitureDimensions | null> {
    if (!this.endpoint) return null; // not configured in this build
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || typeof data.widthMm !== 'number' || typeof data.depthMm !== 'number') {
        return null;
      }
      return {
        name: typeof data.name === 'string' ? data.name : query,
        widthMm: data.widthMm,
        depthMm: data.depthMm,
        heightMm: typeof data.heightMm === 'number' ? data.heightMm : 0,
        source: 'llm',
        confidence: 'estimated',
      };
    } catch {
      return null;
    }
  }
}

/**
 * Parses dimensions from a product page (via your serverless proxy).
 * Inert until an endpoint is provided. Same response contract as LLMProvider.
 */
export class ScraperProvider implements FurnitureProvider {
  readonly id = 'scraper';
  readonly label = 'Web lookup';
  constructor(private readonly endpoint?: string) {}
  async lookup(query: string): Promise<FurnitureDimensions | null> {
    if (!this.endpoint) return null; // not configured in this build
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || typeof data.widthMm !== 'number' || typeof data.depthMm !== 'number') {
        return null;
      }
      return {
        name: typeof data.name === 'string' ? data.name : query,
        widthMm: data.widthMm,
        depthMm: data.depthMm,
        heightMm: typeof data.heightMm === 'number' ? data.heightMm : 0,
        source: 'scraper',
        confidence: 'estimated',
      };
    } catch {
      return null;
    }
  }
}

/** v1 default — no lookup performed; caller falls through to a manual-entry form. */
export class ManualProvider implements FurnitureProvider {
  readonly id = 'manual';
  readonly label = 'Manual entry';
  async lookup(_query: string): Promise<FurnitureDimensions | null> {
    return null;
  }
}

/** Registry walks providers in order until one returns a hit. */
export class ProviderRegistry {
  private providers: FurnitureProvider[];
  constructor(providers: FurnitureProvider[]) {
    this.providers = providers;
  }
  async lookup(query: string): Promise<FurnitureDimensions | null> {
    for (const p of this.providers) {
      const result = await p.lookup(query);
      if (result) return result;
    }
    return null;
  }
}

/**
 * To enable real lookups, set these to your hosted serverless proxy URLs
 * (e.g. a Netlify function or Cloudflare Worker that holds the API key).
 * Left undefined here so the providers stay inert in the static build.
 */
const LLM_ENDPOINT: string | undefined = undefined;
const SCRAPER_ENDPOINT: string | undefined = undefined;

// Order = preference: free/offline first, paid/remote next, manual last.
export const defaultRegistry = new ProviderRegistry([
  new SampleProvider(),
  new LLMProvider(LLM_ENDPOINT),
  new ScraperProvider(SCRAPER_ENDPOINT),
  new ManualProvider(),
]);
