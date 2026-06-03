import type { FurniturePreset } from '../types';

/**
 * Built-in furniture presets — standard real-world dimensions in mm.
 * Width = the wider face, Depth = how far it sticks out. Height is informational.
 * These bootstrap the library so the user isn't typing dimensions for common items.
 */
export const FURNITURE_PRESETS: FurniturePreset[] = [
  // ── Beds ──
  { category: 'Beds', name: 'Single bed', widthMm: 900, depthMm: 1900, heightMm: 500 },
  { category: 'Beds', name: 'Small double (UK)', widthMm: 1200, depthMm: 1900, heightMm: 500 },
  { category: 'Beds', name: 'Double bed (UK)', widthMm: 1350, depthMm: 1900, heightMm: 500 },
  { category: 'Beds', name: 'King (UK)', widthMm: 1500, depthMm: 2000, heightMm: 500 },
  { category: 'Beds', name: 'Super king (UK)', widthMm: 1800, depthMm: 2000, heightMm: 500 },
  { category: 'Beds', name: 'Queen (US)', widthMm: 1524, depthMm: 2032, heightMm: 500 },
  { category: 'Beds', name: 'King (US)', widthMm: 1930, depthMm: 2032, heightMm: 500 },

  // ── Seating ──
  { category: 'Seating', name: '2-seat sofa', widthMm: 1600, depthMm: 900, heightMm: 850 },
  { category: 'Seating', name: '3-seat sofa', widthMm: 2100, depthMm: 950, heightMm: 850 },
  { category: 'Seating', name: 'Armchair', widthMm: 850, depthMm: 850, heightMm: 900 },
  { category: 'Seating', name: 'Dining chair', widthMm: 500, depthMm: 500, heightMm: 900 },

  // ── Tables ──
  { category: 'Tables', name: 'Coffee table', widthMm: 1100, depthMm: 600, heightMm: 450 },
  { category: 'Tables', name: 'Dining (4-seat)', widthMm: 1200, depthMm: 800, heightMm: 750 },
  { category: 'Tables', name: 'Dining (6-seat)', widthMm: 1800, depthMm: 900, heightMm: 750 },
  { category: 'Tables', name: 'Desk', widthMm: 1400, depthMm: 700, heightMm: 740 },
  {
    category: 'Tables', name: 'L-shaped desk', widthMm: 1600, depthMm: 1200, heightMm: 740,
    shape: { kind: 'lshape', cutCorner: 'tr', armThicknessMm: 600 },
  },
  {
    category: 'Tables', name: 'Corner desk (L)', widthMm: 1400, depthMm: 1400, heightMm: 740,
    shape: { kind: 'lshape', cutCorner: 'tl', armThicknessMm: 550 },
  },
  { category: 'Tables', name: 'TV unit', widthMm: 1500, depthMm: 400, heightMm: 500 },

  // ── Storage ──
  { category: 'Storage', name: 'Wardrobe (single)', widthMm: 1000, depthMm: 600, heightMm: 2000 },
  { category: 'Storage', name: 'Wardrobe (double)', widthMm: 1800, depthMm: 600, heightMm: 2000 },
  { category: 'Storage', name: 'Chest of drawers', widthMm: 800, depthMm: 450, heightMm: 1000 },
  { category: 'Storage', name: 'Bedside table', widthMm: 450, depthMm: 400, heightMm: 550 },
  { category: 'Storage', name: 'Bookshelf', widthMm: 800, depthMm: 300, heightMm: 1800 },

  // ── Kitchen ──
  { category: 'Kitchen', name: 'Fridge-freezer', widthMm: 600, depthMm: 650, heightMm: 1800 },
  { category: 'Kitchen', name: 'Washing machine', widthMm: 600, depthMm: 600, heightMm: 850 },
  { category: 'Kitchen', name: 'Dishwasher', widthMm: 600, depthMm: 600, heightMm: 850 },
  { category: 'Kitchen', name: 'Oven / cooker', widthMm: 600, depthMm: 600, heightMm: 900 },

  // ── Bathroom ──
  { category: 'Bathroom', name: 'Toilet', widthMm: 400, depthMm: 700, heightMm: 800 },
  { category: 'Bathroom', name: 'Basin', widthMm: 600, depthMm: 450, heightMm: 850 },
  { category: 'Bathroom', name: 'Bath', widthMm: 1700, depthMm: 700, heightMm: 550 },
  { category: 'Bathroom', name: 'Shower', widthMm: 900, depthMm: 900, heightMm: 2000 },
];

/** Distinct categories in catalog order. */
export const PRESET_CATEGORIES: string[] = Array.from(
  FURNITURE_PRESETS.reduce((set, p) => set.add(p.category), new Set<string>())
);
