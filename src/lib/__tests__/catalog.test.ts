import { describe, expect, it } from 'vitest';
import raw from '../furniture/catalog.json';
import { CATALOG_CATEGORIES, fromRaw, loadCatalog, normalize, searchCatalog, type CatalogItem } from '../furniture/catalog';
import { polygonArea } from './helpers';

type Raw = Parameters<typeof fromRaw>[0];

const item = (over: Partial<CatalogItem>): CatalogItem => ({
  store: 'ikea',
  category: 'Storage',
  name: 'BILLY Bookcase',
  widthMm: 800,
  depthMm: 280,
  heightMm: 2020,
  imageUrl: null,
  productUrl: null,
  confidence: 'verified',
  ...over,
});

describe('normalize', () => {
  it('ignores case, accents, punctuation and "&" vs "and"', () => {
    expect(normalize('  POÄNG  Armchair ')).toBe('poang armchair');
    expect(normalize('B&Q')).toBe('b and q');
    expect(normalize('Corner sofa, 4-seat')).toBe('corner sofa 4 seat');
  });
});

describe('searchCatalog', () => {
  const items = [
    item({ name: 'KALLAX Shelving unit' }),
    item({ name: 'POÄNG Armchair', category: 'Seating' }),
    item({ name: 'Billy-style bookcase', store: 'bq' }),
    item({ name: 'BILLY Bookcase' }),
    item({ name: 'Black corner sofa', category: 'Seating', store: 'argos' }),
  ];
  const names = (query: string, store: CatalogItem['store'] | 'all' = 'all', category: CatalogItem['category'] | 'all' = 'all') =>
    searchCatalog(items, { query, store, category }).map(i => i.name);

  it('matches every word as a word prefix', () => {
    expect(names('kall')).toEqual(['KALLAX Shelving unit']);
    expect(names('poang')).toEqual(['POÄNG Armchair']);
    expect(names('lack')).toEqual([]); // not inside "black"
  });

  it('searches the store and category too', () => {
    expect(names('argos sofa')).toEqual(['Black corner sofa']);
    expect(names('b&q')).toEqual(['Billy-style bookcase']);
  });

  it('puts names starting with the first word first, then keeps store order', () => {
    expect(names('billy')).toEqual(['Billy-style bookcase', 'BILLY Bookcase']);
    expect(names('bookcase billy')).toEqual(['Billy-style bookcase', 'BILLY Bookcase']);
  });

  it('filters by store and category', () => {
    expect(names('', 'ikea', 'Seating')).toEqual(['POÄNG Armchair']);
    expect(names('', 'argos')).toEqual(['Black corner sofa']);
  });
});

describe('fromRaw', () => {
  const base: Raw = { s: 'ikea', c: 'Tables', n: 'LISABO Table', w: 1050, d: 1050, h: 740, u: 'lisabo-table-40416498' };

  it('builds a round table as a polygon of the right size', () => {
    const t = fromRaw({ ...base, sh: 'R' });
    expect(t.shape?.kind).toBe('polygon');
    const pts = t.shape?.kind === 'polygon' ? t.shape.points : [];
    expect(pts).toHaveLength(24);
    expect(Math.max(...pts.map(p => Math.hypot(p.x, p.y)))).toBeCloseTo(525, 0);
    // Close to πr² (a 24-gon is ~1.1% smaller).
    expect(polygonArea(pts) / (Math.PI * 525 * 525)).toBeGreaterThan(0.98);
  });

  it('builds a corner sofa as an L with the seat depth as its arm', () => {
    const t = fromRaw({ ...base, c: 'Seating', n: 'KIVIK Corner sofa', w: 2570, d: 2570, sh: 950 });
    expect(t.shape).toEqual({ kind: 'lshape', cutCorner: 'tr', armThicknessMm: 950 });
  });

  it('links to each store and marks marketplace data as estimated', () => {
    expect(fromRaw({ ...base, i: 'x.jpg' }).imageUrl).toMatch(/^https:\/\/www\.ikea\.com\/gb\/en\/images\/products\/x\.jpg/);
    expect(fromRaw(base).productUrl).toBe('https://www.ikea.com/gb/en/p/lisabo-table-40416498/');
    expect(fromRaw(base).imageUrl).toBeNull();
    expect(fromRaw({ ...base, s: 'argos', u: '3429523' }).productUrl).toBe('https://www.argos.co.uk/product/3429523');
    expect(fromRaw({ ...base, s: 'bq', e: 1 }).confidence).toBe('estimated');
    expect(fromRaw(base).confidence).toBe('verified');
  });
});

describe('the shipped catalog', () => {
  it('has plausible, complete entries', async () => {
    const all = await loadCatalog();
    expect(all.length).toBeGreaterThan(300);
    for (const e of raw as Raw[]) {
      expect(CATALOG_CATEGORIES).toContain(e.c);
      expect(Math.min(e.w, e.d)).toBeGreaterThanOrEqual(250);
      expect(Math.max(e.w, e.d)).toBeLessThanOrEqual(4000);
      expect(e.h).toBeLessThanOrEqual(2700);
      expect(e.n.trim()).toBe(e.n);
      expect(e.u).toBeTruthy();
    }
  });

  it('covers every store', async () => {
    const stores = new Set((await loadCatalog()).map(i => i.store));
    expect([...stores].sort()).toEqual(['argos', 'bq', 'ikea', 'johnlewis', 'next', 'tesco']);
  });
});
