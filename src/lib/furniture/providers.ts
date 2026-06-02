import type { FurnitureDimensions } from '../../types';

/**
 * FurnitureProvider — the swap point for richer furniture lookups.
 *
 * v1 ships ManualProvider only. Later sprints will add:
 *   - LLMProvider     (ask Claude/GPT for dimensions of a named model)
 *   - ScraperProvider (parse IKEA/Wayfair product pages)
 *
 * Adding a new provider should require zero UI changes — the registry
 * walks providers in order and the calling component reacts to whatever
 * the first non-null result returns. The user gets a "confirm dimensions"
 * modal before placement either way, so estimated results are always
 * surfaced as such.
 */
export interface FurnitureProvider {
  readonly id: string;
  readonly label: string;
  /** Return null if this provider can't satisfy the query. */
  lookup(query: string): Promise<FurnitureDimensions | null>;
}

/** v1 default — no lookup performed; caller falls through to a manual-entry form. */
export class ManualProvider implements FurnitureProvider {
  readonly id = 'manual';
  readonly label = 'Manual entry';
  async lookup(_query: string): Promise<FurnitureDimensions | null> {
    return null;
  }
}

// TODO Sprint 3: implement and register. Keeping the file slot here so the
// future provider class lands in a predictable place.
// export class LLMProvider implements FurnitureProvider { ... }
// export class ScraperProvider implements FurnitureProvider { ... }

/**
 * Registry walks providers in order until one returns a hit.
 * Order matters: cheaper/more-reliable first.
 */
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

export const defaultRegistry = new ProviderRegistry([new ManualProvider()]);
