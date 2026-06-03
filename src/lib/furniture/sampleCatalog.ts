/**
 * A small built-in catalog of well-known products, used by SampleProvider as a
 * working reference implementation of the lookup flow — no backend required.
 *
 * Dimensions are APPROXIMATE (rounded, sourced from memory of public spec sheets)
 * and intentionally returned with confidence 'estimated' so the UI prompts the
 * user to verify before placing. This is illustrative sample data, not a
 * maintained product database. The real lookup story is LLMProvider /
 * ScraperProvider once a backend endpoint is wired up.
 */
export type CatalogEntry = {
  name: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  /** Lowercased substrings; a query matches if it contains any alias. */
  aliases: string[];
};

export const SAMPLE_CATALOG: CatalogEntry[] = [
  {
    name: 'IKEA Malm 6-drawer chest',
    widthMm: 1600, depthMm: 480, heightMm: 780,
    aliases: ['malm 6', 'malm six', 'malm 6-drawer', 'malm chest'],
  },
  {
    name: 'IKEA Malm bed frame (double)',
    widthMm: 1650, depthMm: 2090, heightMm: 380,
    aliases: ['malm bed', 'malm double', 'malm frame'],
  },
  {
    name: 'IKEA Billy bookcase',
    widthMm: 800, depthMm: 280, heightMm: 2020,
    aliases: ['billy', 'billy bookcase'],
  },
  {
    name: 'IKEA Kallax 4x4 shelf',
    widthMm: 1470, depthMm: 390, heightMm: 1470,
    aliases: ['kallax', 'kallax 4', 'expedit'],
  },
  {
    name: 'IKEA Ektorp 3-seat sofa',
    widthMm: 2180, depthMm: 880, heightMm: 880,
    aliases: ['ektorp', 'ektorp 3', 'ektorp sofa'],
  },
  {
    name: 'IKEA Poäng armchair',
    widthMm: 680, depthMm: 820, heightMm: 1000,
    aliases: ['poang', 'poäng'],
  },
  {
    name: 'IKEA Lack coffee table',
    widthMm: 900, depthMm: 550, heightMm: 450,
    aliases: ['lack', 'lack table', 'lack coffee'],
  },
  {
    name: 'IKEA Hemnes 8-drawer chest',
    widthMm: 1600, depthMm: 500, heightMm: 960,
    aliases: ['hemnes 8', 'hemnes chest', 'hemnes dresser'],
  },
  {
    name: 'IKEA Brimnes wardrobe (3-door)',
    widthMm: 1170, depthMm: 500, heightMm: 1900,
    aliases: ['brimnes', 'brimnes wardrobe'],
  },
];

/** Normalize a query for matching: lowercase, collapse whitespace. */
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Find a catalog entry whose alias appears in the query. */
export function matchCatalog(query: string): CatalogEntry | null {
  const q = normalize(query);
  if (!q) return null;
  for (const entry of SAMPLE_CATALOG) {
    if (entry.aliases.some(a => q.includes(a))) return entry;
  }
  return null;
}
