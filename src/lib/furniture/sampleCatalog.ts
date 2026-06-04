/**
 * A built-in starter catalog of common IKEA products, used by SampleProvider so
 * the lookup flow works offline with no backend.
 *
 * Dimensions are APPROXIMATE (rounded, from public spec sheets) and returned
 * with confidence 'estimated' — the confirm step lets the user correct them.
 * This is a curated starter set, not exhaustive. Unlimited coverage is the job
 * of LLMProvider / ScraperProvider once a backend endpoint is configured.
 */
export type CatalogEntry = {
  name: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  /** Lowercased substrings; longest alias found in the query wins. */
  aliases: string[];
};

export const SAMPLE_CATALOG: CatalogEntry[] = [
  // ── Bedroom: beds ──
  { name: 'IKEA Malm bed frame (double)', widthMm: 1650, depthMm: 2090, heightMm: 380, aliases: ['malm bed', 'malm double', 'malm frame'] },
  { name: 'IKEA Hemnes bed frame (double)', widthMm: 1560, depthMm: 2110, heightMm: 1200, aliases: ['hemnes bed'] },
  { name: 'IKEA Tarva bed frame (double)', widthMm: 1480, depthMm: 2070, heightMm: 920, aliases: ['tarva'] },
  { name: 'IKEA Songesand bed frame (double)', widthMm: 1560, depthMm: 2090, heightMm: 950, aliases: ['songesand'] },

  // ── Bedroom: storage ──
  { name: 'IKEA Malm 6-drawer chest', widthMm: 1600, depthMm: 480, heightMm: 780, aliases: ['malm 6', 'malm six', 'malm 6-drawer', 'malm chest', 'malm dresser'] },
  { name: 'IKEA Hemnes 8-drawer chest', widthMm: 1600, depthMm: 500, heightMm: 960, aliases: ['hemnes 8', 'hemnes chest', 'hemnes dresser'] },
  { name: 'IKEA Nordli 6-drawer chest', widthMm: 1200, depthMm: 470, heightMm: 990, aliases: ['nordli'] },
  { name: 'IKEA Kullen 5-drawer chest', widthMm: 700, depthMm: 400, heightMm: 1120, aliases: ['kullen'] },
  { name: 'IKEA Brimnes wardrobe (3-door)', widthMm: 1170, depthMm: 500, heightMm: 1900, aliases: ['brimnes wardrobe', 'brimnes'] },
  { name: 'IKEA Pax wardrobe (2-door)', widthMm: 1000, depthMm: 600, heightMm: 2010, aliases: ['pax'] },

  // ── Living: seating ──
  { name: 'IKEA Ektorp 3-seat sofa', widthMm: 2180, depthMm: 880, heightMm: 880, aliases: ['ektorp'] },
  { name: 'IKEA Kivik 3-seat sofa', widthMm: 2280, depthMm: 950, heightMm: 830, aliases: ['kivik'] },
  { name: 'IKEA Klippan 2-seat sofa', widthMm: 1800, depthMm: 880, heightMm: 660, aliases: ['klippan'] },
  { name: 'IKEA Söderhamn 3-seat sofa', widthMm: 1980, depthMm: 990, heightMm: 830, aliases: ['soderhamn', 'söderhamn'] },
  { name: 'IKEA Friheten corner sofa-bed', widthMm: 2300, depthMm: 1510, heightMm: 660, aliases: ['friheten'] },
  { name: 'IKEA Poäng armchair', widthMm: 680, depthMm: 820, heightMm: 1000, aliases: ['poang', 'poäng'] },
  { name: 'IKEA Strandmon wing chair', widthMm: 820, depthMm: 960, heightMm: 1010, aliases: ['strandmon', 'wing chair'] },

  // ── Living: tables / storage ──
  { name: 'IKEA Lack side table', widthMm: 550, depthMm: 550, heightMm: 450, aliases: ['lack side'] },
  { name: 'IKEA Lack coffee table', widthMm: 900, depthMm: 550, heightMm: 450, aliases: ['lack coffee', 'lack table', 'lack'] },
  { name: 'IKEA Lisabo dining table', widthMm: 1400, depthMm: 780, heightMm: 740, aliases: ['lisabo'] },
  { name: 'IKEA Ingatorp dining table', widthMm: 1550, depthMm: 870, heightMm: 740, aliases: ['ingatorp'] },
  { name: 'IKEA Besta unit', widthMm: 1200, depthMm: 420, heightMm: 640, aliases: ['besta', 'bestå'] },
  { name: 'IKEA Billy bookcase', widthMm: 800, depthMm: 280, heightMm: 2020, aliases: ['billy'] },
  { name: 'IKEA Kallax 2x4 shelf', widthMm: 770, depthMm: 390, heightMm: 1470, aliases: ['kallax 2'] },
  { name: 'IKEA Kallax 4x4 shelf', widthMm: 1470, depthMm: 390, heightMm: 1470, aliases: ['kallax', 'expedit'] },

  // ── Office ──
  { name: 'IKEA Linnmon/Adils desk', widthMm: 1200, depthMm: 600, heightMm: 740, aliases: ['linnmon', 'adils'] },
  { name: 'IKEA Micke desk', widthMm: 1050, depthMm: 500, heightMm: 750, aliases: ['micke'] },
  { name: 'IKEA Bekant desk', widthMm: 1600, depthMm: 800, heightMm: 740, aliases: ['bekant'] },
  { name: 'IKEA Markus office chair', widthMm: 620, depthMm: 620, heightMm: 1290, aliases: ['markus'] },
  { name: 'IKEA Hemnes shoe cabinet', widthMm: 890, depthMm: 300, heightMm: 1270, aliases: ['hemnes shoe', 'shoe cabinet'] },
];

/** Normalize a query for matching: lowercase, collapse whitespace. */
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Find the best catalog entry for a query: the entry with the LONGEST alias
 * that appears in the query. Longest-wins makes matching order-independent
 * (e.g. "lack side table" → Lack side, not the generic "lack").
 */
export function matchCatalog(query: string): CatalogEntry | null {
  const q = normalize(query);
  if (!q) return null;
  let best: CatalogEntry | null = null;
  let bestLen = 0;
  for (const entry of SAMPLE_CATALOG) {
    for (const a of entry.aliases) {
      if (a.length > bestLen && q.includes(a)) {
        best = entry;
        bestLen = a.length;
      }
    }
  }
  return best;
}
