// Shared types for FloorplanStudio.
// All real-world measurements are stored in MILLIMETRES.
// Display layer (units.ts) converts to the user's chosen system.

export type UnitSystem = 'metric' | 'imperial';

export type Mode = 'select' | 'calibrate' | 'placing' | 'wall';

export type Point = { x: number; y: number };

/** Where a furniture item's dimensions came from. */
export type FurnitureSource = 'manual' | 'catalog' | 'scraper' | 'llm';

/** How much to trust those dimensions. */
export type Confidence = 'user-entered' | 'verified' | 'estimated';

/** Which corner of the bounding box is cut away to form an L. */
export type LShapeCorner = 'tl' | 'tr' | 'bl' | 'br';

/**
 * The footprint shape of a furniture item, parameterised within its W×D
 * bounding box. Absent / 'rect' = a plain rectangle (backward compatible).
 * Concave shapes are decomposed into convex parts for collision (see footprint.ts).
 */
export type FurnitureShape =
  | { kind: 'rect' }
  | { kind: 'lshape'; cutCorner: LShapeCorner; armThicknessMm: number }
  /** Arbitrary footprint drawn in the Furniture Maker. Points are centred mm,
   *  in order around the outline. Concave allowed (triangulated for collision). */
  | { kind: 'polygon'; points: Point[] };

/** A traced wall — a polyline in image pixel-space (>= 2 points). */
export type Wall = {
  id: string;
  points: Point[];
};

/** Calibration: two pixel-space points + the real-world distance between them. */
export type Calibration = {
  points: [Point, Point];
  distanceMm: number;
  /** Derived: how many CSS pixels equal one millimetre on the canvas. */
  pxPerMm: number;
};

/** A piece of furniture placed on the plan. */
export type FurnitureItem = {
  id: string;
  name: string;
  /** Position is the centre of the rectangle, in pixel-space. */
  x: number;
  y: number;
  /** Real-world dimensions in mm. Width = x extent at 0°, depth = y extent at 0°. */
  widthMm: number;
  depthMm: number;
  heightMm: number;
  /** Rotation in degrees, snapped to 15°. */
  rotation: number;
  /** Footprint shape within the W×D box. Absent = rectangle. */
  shape?: FurnitureShape;
  /** Where these dimensions came from — set up for future providers. */
  source: FurnitureSource;
  confidence: Confidence;
  /** Tailwind / hex colour used for the rectangle fill. */
  color: string;
};

/** A saved floorplan. */
export type Plan = {
  id: string;
  name: string;
  /** Base64 data URL of the underlying floorplan image. */
  imageDataUrl: string | null;
  calibration: Calibration | null;
  furniture: FurnitureItem[];
  /** Traced walls used for overlap detection (older saves are migrated on load). */
  walls: Wall[];
  createdAt: number;
  updatedAt: number;
};

/** What a provider returns when asked to look up a furniture model. */
export type FurnitureDimensions = {
  name: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  source: FurnitureSource;
  confidence: Confidence;
};

/** A reusable furniture definition saved to the cross-plan library. */
export type SavedFurniture = {
  id: string;
  name: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  color?: string;
  shape?: FurnitureShape;
  source: FurnitureSource;
  confidence: Confidence;
};

/** A built-in furniture preset (standard dimensions). */
export type FurniturePreset = {
  category: string;
  name: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  shape?: FurnitureShape;
};

/** Template handed to the placement flow. Carries optional styling/provenance. */
export type PlacingTemplate = {
  name: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  color?: string;
  shape?: FurnitureShape;
  source?: FurnitureSource;
  confidence?: Confidence;
};
