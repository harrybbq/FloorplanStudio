// Builds src/lib/furniture/catalog.json from the raw retailer data in
// scripts/catalog-raw/*.json (gathered from each store's own product pages,
// November 2026). Run: node scripts/build-catalog.mjs
//
// Raw row: [category, name, widthMm, depthMm, heightMm, shape, imageKey, productKey]
//   shape: 0 = rectangle, "R" = round, a number = L-shape arm thickness (mm)
//   imageKey / productKey are store-specific (see src/lib/furniture/catalog.ts)
//
// Output entry: { s: store, c: category, n: name, w, d, h, sh?, i?, u, e? }
//   e: 1 marks dimensions that came from a marketplace seller, not the retailer
import { readFileSync, writeFileSync } from 'node:fs';

const STORES = [
  ['ikea', 'ikea.json'],
  ['bq', 'bq.json'],
  ['argos', 'argos.json'],
  ['johnlewis', 'johnlewis.json'],
  ['next', 'next.json'],
];

// Accessories and parts that came up in category listings but aren't furniture you place.
const NOT_FURNITURE =
  /\b(lamp|lighting|leg|table top|monitor stand|bed tray|insert with|laptop stand|wall shelf|footstool|organiser,? set of|pull-out baskets)\b|\b(underbed|mattress)$/i;

/** Re-file by what the name says it is; the store's category listing can be loose. */
function categoryOf(cat, name) {
  const n = name.toLowerCase();
  if (/sofa[- ]?bed|sofabed/.test(n)) return 'Seating';
  if (/\b(day-?bed|bed frame|bed\b|bunk|loft bed|ottoman bed|bedframe)/.test(n) && !/bedside|bedroom (storage|cabinet|furniture)|bed tray/.test(n)) return 'Beds';
  if (/\b(sofa|couch|chair|armchair|recliner|chaise)\b/.test(n)) return 'Seating';
  if (/\b(bedside|dressing table|chest|drawers?|wardrobe|bookcase|shelving|shelf|cabinet|sideboard|tv (bench|stand|unit|cabinet)|entertainment unit|storage (combination|unit)|cupboard)\b/.test(n)) return 'Storage';
  if (/\b(desk|table)\b/.test(n)) return 'Tables';
  return cat;
}

/** Reject listings whose numbers can't be right (seller typos, swapped fields). */
function plausible(c, name, w, d, h) {
  const lo = Math.min(w, d), hi = Math.max(w, d);
  const n = name.toLowerCase();
  if (lo < 250 || hi > 4000 || h > 2700) return false;
  if (c === 'Beds' && (lo < 600 || hi < 1400)) return false;
  if (/\b(corner|l-shaped|u-shaped|sectional)\b/.test(n) && (lo < 700 || hi / lo > 3.5)) return false;
  if (/\btv\b/.test(n) && w < 700) return false;
  if (/\bdesk\b/.test(n) && hi < 600) return false;
  return true;
}

const own = /^(goodhome|form)\b/i; // B&Q's own brands; the rest of diy.com is marketplace sellers

const out = [];
const report = [];
for (const [store, file] of STORES) {
  const rows = JSON.parse(readFileSync(new URL(`./catalog-raw/${file}`, import.meta.url), 'utf8'));
  const seen = new Set();
  let kept = 0;
  const dropped = [];
  for (const [rawCat, rawName, w, d, h, shape, img, url] of rows) {
    const name = rawName.replace(/\s+/g, ' ').trim();
    const c = categoryOf(rawCat, name);
    if (NOT_FURNITURE.test(name) || !plausible(c, name, w, d, h)) {
      dropped.push(name.slice(0, 60));
      continue;
    }
    const key = `${name.toLowerCase()}|${w}|${d}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const e = { s: store, c, n: name, w, d, h };
    if (shape) e.sh = shape;
    if (img) e.i = img;
    e.u = url;
    if (store === 'bq' && !own.test(name)) e.e = 1;
    out.push(e);
    kept++;
  }
  report.push(`${store}: ${kept} kept, ${dropped.length} dropped${dropped.length ? `\n    - ${dropped.join('\n    - ')}` : ''}`);
}

writeFileSync(new URL('../src/lib/furniture/catalog.json', import.meta.url), JSON.stringify(out) + '\n');
console.log(report.join('\n'));
console.log(`total: ${out.length}`);
