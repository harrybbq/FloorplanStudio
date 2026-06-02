import type { Plan, SavedFurniture } from '../types';

const PLANS_KEY = 'fps:plans:v1';
const ACTIVE_PLAN_KEY = 'fps:active-plan:v1';
const UNITS_KEY = 'fps:units:v1';
const LIBRARY_KEY = 'fps:library:v1';

export function loadPlans(): Plan[] {
  try {
    const raw = localStorage.getItem(PLANS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Migrate plans saved before `walls` existed.
    return parsed.map((p: Plan) => ({ ...p, walls: Array.isArray(p.walls) ? p.walls : [] }));
  } catch {
    return [];
  }
}

export function savePlans(plans: Plan[]): void {
  try {
    localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
  } catch (err) {
    // quotaExceeded is the realistic failure here (large base64 images).
    console.warn('Failed to save plans to localStorage', err);
  }
}

export function loadActivePlanId(): string | null {
  return localStorage.getItem(ACTIVE_PLAN_KEY);
}

export function saveActivePlanId(id: string | null): void {
  if (id) localStorage.setItem(ACTIVE_PLAN_KEY, id);
  else localStorage.removeItem(ACTIVE_PLAN_KEY);
}

export function loadUnits(): 'metric' | 'imperial' {
  const v = localStorage.getItem(UNITS_KEY);
  return v === 'imperial' ? 'imperial' : 'metric';
}

export function saveUnits(units: 'metric' | 'imperial'): void {
  localStorage.setItem(UNITS_KEY, units);
}

export function loadLibrary(): SavedFurniture[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLibrary(items: SavedFurniture[]): void {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('Failed to save furniture library to localStorage', err);
  }
}
