// Shared types for FloorplanStudio.
// All real-world measurements are stored in MILLIMETRES.
// Display layer (units.ts) converts to the user's chosen system.

export type UnitSystem = 'metric' | 'imperial';

export type Mode = 'select' | 'calibrate' | 'placing';

export type Point = { x: number; y: number };

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
  /** Where these dimensions came from — set up for future providers. */
  source: 'manual' | 'scraper' | 'llm';
  confidence: 'user-entered' | 'verified' | 'estimated';
  /** Tailwind / hex colour used for the rectangle fill. */
  color: string;
};

/** A saved floorplan. */
export type Plan = {
  id: string;
  name: string;
  /** Base64 data URL of the underlying floorplan image. */
  imageDataUrl: string | null;
  /** Natural image dimensions (so we can lay it out on the stage). */
  imageWidth: number;
  imageHeight: number;
  calibration: Calibration | null;
  furniture: FurnitureItem[];
  createdAt: number;
  updatedAt: number;
};

/** What a provider returns when asked to look up a furniture model. */
export type FurnitureDimensions = {
  name: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  source: 'manual' | 'scraper' | 'llm';
  confidence: 'user-entered' | 'verified' | 'estimated';
};
