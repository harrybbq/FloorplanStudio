import type { Plan, SavedFurniture, UnitSystem } from '../types';

/**
 * localStorage persistence.
 *
 * Plans are stored WITHOUT their image; each plan's base64 image lives under its
 * own key and is only written when it changes. That keeps the frequent writes
 * (every drag, rotate, wall point) tiny instead of re-serialising every image.
 *
 * Every write returns false when the browser refuses it (usually the ~5 MB quota),
 * so the store can tell the user their work isn't being saved.
 */
const PLANS_KEY = 'fps:plans:v1';
const ACTIVE_PLAN_KEY = 'fps:active-plan:v1';
const UNITS_KEY = 'fps:units:v1';
const LIBRARY_KEY = 'fps:library:v1';
const imageKey = (planId: string) => `fps:image:${planId}`;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): boolean {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`Failed to save ${key}`, err);
    return false;
  }
}

function readJsonArray<T>(key: string): T[] {
  try {
    const parsed = JSON.parse(read(key) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Plans whose image could not be moved to its own key (quota). Their image stays
 * inline in the plans record so stripping it on save can never lose it.
 */
const inlineImages = new Set<string>();

export function loadPlans(): Plan[] {
  const stored = readJsonArray<Plan>(PLANS_KEY);
  let migrated = false;

  const plans = stored.map(p => {
    let imageDataUrl = p.imageDataUrl ?? null;
    if (imageDataUrl) {
      // Pre-split format kept the image inline — move it to its own key.
      if (write(imageKey(p.id), imageDataUrl)) migrated = true;
      else inlineImages.add(p.id);
    } else {
      imageDataUrl = read(imageKey(p.id));
    }
    return {
      ...p,
      imageDataUrl,
      walls: Array.isArray(p.walls) ? p.walls : [],
      rooms: Array.isArray(p.rooms) ? p.rooms : [],
    };
  });

  if (migrated) savePlans(plans);
  return plans;
}

/** Persist plan metadata/furniture/walls. Images are saved separately (saveImage). */
export function savePlans(plans: Plan[]): boolean {
  const slim = plans.map(p => (inlineImages.has(p.id) ? p : { ...p, imageDataUrl: null }));
  return write(PLANS_KEY, JSON.stringify(slim));
}

export function saveImage(planId: string, dataUrl: string | null): boolean {
  const ok = write(imageKey(planId), dataUrl);
  if (ok) inlineImages.delete(planId);
  return ok;
}

export function loadActivePlanId(): string | null {
  return read(ACTIVE_PLAN_KEY);
}

export function saveActivePlanId(id: string | null): void {
  write(ACTIVE_PLAN_KEY, id);
}

export function loadUnits(): UnitSystem {
  return read(UNITS_KEY) === 'imperial' ? 'imperial' : 'metric';
}

export function saveUnits(units: UnitSystem): void {
  write(UNITS_KEY, units);
}

export function loadLibrary(): SavedFurniture[] {
  return readJsonArray<SavedFurniture>(LIBRARY_KEY);
}

export function saveLibrary(items: SavedFurniture[]): boolean {
  return write(LIBRARY_KEY, JSON.stringify(items));
}
