import type { Confidence, FurnitureShape, Point } from '../../types';

/**
 * The built-in product catalog: real dimensions for a few hundred larger pieces
 * (beds, sofas, storage, tables) from UK retailers' own product pages, plus a
 * handful of generic Tesco estimates. Data lives in catalog.json, built by
 * scripts/build-catalog.mjs, and loads on demand (it's ~70 KB).
 *
 * Images are the retailers' own, loaded from their sites by URL (never copied).
 * A link can break when a retailer changes it; the UI falls back to an icon.
 */
export const STORES = {
  ikea: 'IKEA',
  bq: 'B&Q',
  argos: 'Argos',
  johnlewis: 'John Lewis',
  next: 'Next',
  tesco: 'Tesco',
} as const;
export type Store = keyof typeof STORES;

export const CATALOG_CATEGORIES = ['Beds', 'Seating', 'Storage', 'Tables'] as const;
export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

export type CatalogItem = {
  store: Store;
  category: CatalogCategory;
  name: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  shape?: FurnitureShape;
  imageUrl: string | null;
  productUrl: string | null;
  /** 'verified' = from the retailer's page; 'estimated' = marketplace-seller data or a generic size. */
  confidence: Confidence;
};

/** catalog.json entry (see scripts/build-catalog.mjs). */
type RawEntry = {
  s: Exclude<Store, 'tesco'>;
  c: CatalogCategory;
  n: string;
  w: number;
  d: number;
  h: number;
  sh?: 'R' | number;
  i?: string;
  u: string;
  e?: 1;
};

const THUMB = 160;

const imageUrl: Record<RawEntry['s'], (key: string) => string> = {
  ikea: k => `https://www.ikea.com/gb/en/images/products/${k.replace(/_s5\.jpg$/, '_s3.jpg')}`, // _s3 = 250 px
  bq: k => `https://media.diy.com/is/image/KingfisherDigital/${k}?$MOB_PREV$&$width=${THUMB}&$height=${THUMB}`,
  argos: k => `https://media.4rgos.it/s/Argos/${k}_R_SET?w=${THUMB}&h=${THUMB}`,
  johnlewis: k => `https://media.johnlewiscontent.com/i/JohnLewis/${k}?fmt=auto&wid=${THUMB}&hei=${THUMB}`,
  next: k => `https://xcdn.next.co.uk/common/items/default/default/itemimages/3_4Ratio/product/lge/${k}?im=Resize,width=${THUMB}`,
};

const productUrl: Record<RawEntry['s'], (key: string) => string> = {
  ikea: k => `https://www.ikea.com/gb/en/p/${k}/`,
  bq: k => `https://www.diy.com/departments/${k}`,
  argos: k => `https://www.argos.co.uk/product/${k}`,
  johnlewis: k => `https://www.johnlewis.com${k}`,
  next: k => `https://www.next.co.uk/style/${k}`,
};

const ROUND_SIDES = 24;

/** A round piece as a polygon (the shape system collides convex polygons exactly). */
export function roundShape(diameterMm: number): FurnitureShape {
  const r = diameterMm / 2;
  const points: Point[] = Array.from({ length: ROUND_SIDES }, (_, k) => {
    const a = (2 * Math.PI * k) / ROUND_SIDES;
    return { x: Math.round(r * Math.cos(a) * 10) / 10, y: Math.round(r * Math.sin(a) * 10) / 10 };
  });
  return { kind: 'polygon', points };
}

export function fromRaw(e: RawEntry): CatalogItem {
  return {
    store: e.s,
    category: e.c,
    name: e.n,
    widthMm: e.w,
    depthMm: e.d,
    heightMm: e.h,
    shape: e.sh === 'R' ? roundShape(e.w) : e.sh ? { kind: 'lshape', cutCorner: 'tr', armThicknessMm: e.sh } : undefined,
    imageUrl: e.i ? imageUrl[e.s](e.i) : null,
    productUrl: productUrl[e.s](e.u),
    confidence: e.e ? 'estimated' : 'verified',
  };
}

/** Generic sizes for Tesco's range, which doesn't publish dimensions consistently. */
const TESCO: CatalogItem[] = (
  [
    ['Storage', 'Fox & Ivy wardrobe (2-door)', 900, 520, 1800],
    ['Storage', '3-drawer bedside chest', 450, 400, 550],
    ['Seating', '2-seater sofa', 1600, 850, 850],
    ['Tables', 'Dining table (4-seat)', 1200, 750, 750],
    ['Storage', 'Bookcase (5-shelf)', 700, 300, 1800],
    ['Beds', 'Ottoman storage bed (double)', 1500, 2000, 1000],
  ] as const
).map(([category, name, widthMm, depthMm, heightMm]) => ({
  store: 'tesco',
  category,
  name,
  widthMm,
  depthMm,
  heightMm,
  imageUrl: null,
  productUrl: null,
  confidence: 'estimated',
}));

let loaded: Promise<CatalogItem[]> | null = null;

/** The whole catalog, loaded once on first use. */
export function loadCatalog(): Promise<CatalogItem[]> {
  loaded ??= import('./catalog.json').then(m => [...(m.default as RawEntry[]).map(fromRaw), ...TESCO]);
  return loaded;
}

/**
 * Lower-case, accent-free, "&" → "and", punctuation → spaces, so "poäng",
 * "Poang" and "POÄNG" all match, and "b&q" matches "B & Q".
 */
export function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const searchText = new WeakMap<CatalogItem, string>();
const textOf = (item: CatalogItem) => {
  let t = searchText.get(item);
  if (t === undefined) {
    t = ` ${normalize(`${STORES[item.store]} ${item.name} ${item.category}`)} `;
    searchText.set(item, t);
  }
  return t;
};

export type CatalogFilter = { query: string; store: Store | 'all'; category: CatalogCategory | 'all' };

/**
 * Items matching every word of the query (as a word prefix, so "kall" finds
 * KALLAX), in the store's own popularity order. Items whose name starts with
 * the first word (the product range, e.g. "billy") come first.
 */
export function searchCatalog(items: CatalogItem[], { query, store, category }: CatalogFilter): CatalogItem[] {
  const words = normalize(query).split(' ').filter(Boolean);
  const hits = items.filter(
    item =>
      (store === 'all' || item.store === store) &&
      (category === 'all' || item.category === category) &&
      words.every(w => textOf(item).includes(` ${w}`))
  );
  if (!words.length) return hits;
  const lead = (item: CatalogItem) => (normalize(item.name).startsWith(words[0]) ? 0 : 1);
  return hits.map((item, i) => ({ item, i })).sort((a, b) => lead(a.item) - lead(b.item) || a.i - b.i).map(x => x.item);
}
