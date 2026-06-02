import { create } from 'zustand';
import type { Calibration, FurnitureItem, Mode, Plan, Point, UnitSystem } from '../types';
import {
  loadActivePlanId,
  loadPlans,
  loadUnits,
  saveActivePlanId,
  savePlans,
  saveUnits,
} from '../lib/storage';

const FURNITURE_COLORS = [
  '#c8970a', // gold
  '#1a7a4a', // em
  '#d4700a', // amber
  '#8b7355', // brown
  '#4a4540', // ink-mid
  '#2a9e62', // em-mid
];

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function blankPlan(name = 'Untitled plan'): Plan {
  const now = Date.now();
  return {
    id: newId(),
    name,
    imageDataUrl: null,
    imageWidth: 0,
    imageHeight: 0,
    calibration: null,
    furniture: [],
    createdAt: now,
    updatedAt: now,
  };
}

type PlacingTemplate = {
  name: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
};

interface PlanState {
  plans: Plan[];
  activePlanId: string | null;
  units: UnitSystem;
  mode: Mode;
  selectedFurnitureId: string | null;
  /** Calibration: first click is stored here; second click + distance commits a Calibration. */
  pendingCalibrationPoint: Point | null;
  /** Furniture template currently being placed (after Add Furniture form submission). */
  placingTemplate: PlacingTemplate | null;
  /** Cached HTMLImageElement for the active plan's floorplan, for Konva. */
  imageElement: HTMLImageElement | null;

  // — derived helpers —
  active: () => Plan | null;

  // — plan CRUD —
  createPlan: (name?: string) => string;
  deletePlan: (id: string) => void;
  selectPlan: (id: string) => void;
  renamePlan: (id: string, name: string) => void;

  // — image —
  setPlanImage: (dataUrl: string, width: number, height: number) => void;

  // — calibration —
  // Canvas flow: setMode('calibrate') → first click stores pendingCalibrationPoint →
  // second click opens the dialog → commitCalibrationWithPoints() (below) finalises it.
  startCalibration: () => void;
  addCalibrationPoint: (p: Point) => void;
  clearCalibration: () => void;
  cancelPendingCalibration: () => void;

  // — furniture —
  beginPlacing: (template: PlacingTemplate) => void;
  cancelPlacing: () => void;
  placeFurnitureAt: (x: number, y: number) => void;
  updateFurniture: (id: string, patch: Partial<FurnitureItem>) => void;
  deleteFurniture: (id: string) => void;
  rotateFurniture: (id: string, deltaDeg: number) => void;
  selectFurniture: (id: string | null) => void;

  // — misc —
  setMode: (mode: Mode) => void;
  setUnits: (units: UnitSystem) => void;
  setImageElement: (el: HTMLImageElement | null) => void;
}

const initialPlans = loadPlans();
const initialActiveId =
  loadActivePlanId() && initialPlans.some(p => p.id === loadActivePlanId())
    ? loadActivePlanId()
    : initialPlans[0]?.id ?? null;

export const usePlanStore = create<PlanState>((set, get) => ({
  plans: initialPlans,
  activePlanId: initialActiveId,
  units: loadUnits(),
  mode: 'select',
  selectedFurnitureId: null,
  pendingCalibrationPoint: null,
  placingTemplate: null,
  imageElement: null,

  active: () => {
    const { plans, activePlanId } = get();
    return plans.find(p => p.id === activePlanId) ?? null;
  },

  createPlan: (name) => {
    const p = blankPlan(name);
    set(state => {
      const plans = [...state.plans, p];
      savePlans(plans);
      saveActivePlanId(p.id);
      return {
        plans,
        activePlanId: p.id,
        mode: 'select',
        selectedFurnitureId: null,
        pendingCalibrationPoint: null,
        placingTemplate: null,
        imageElement: null,
      };
    });
    return p.id;
  },

  deletePlan: (id) => {
    set(state => {
      const plans = state.plans.filter(p => p.id !== id);
      savePlans(plans);
      const newActive = state.activePlanId === id ? (plans[0]?.id ?? null) : state.activePlanId;
      saveActivePlanId(newActive);
      return {
        plans,
        activePlanId: newActive,
        imageElement: state.activePlanId === id ? null : state.imageElement,
      };
    });
  },

  selectPlan: (id) => {
    set({
      activePlanId: id,
      selectedFurnitureId: null,
      mode: 'select',
      pendingCalibrationPoint: null,
      placingTemplate: null,
      imageElement: null,
    });
    saveActivePlanId(id);
  },

  renamePlan: (id, name) => {
    set(state => {
      const plans = state.plans.map(p =>
        p.id === id ? { ...p, name, updatedAt: Date.now() } : p
      );
      savePlans(plans);
      return { plans };
    });
  },

  setPlanImage: (dataUrl, width, height) => {
    const { activePlanId, plans } = get();
    if (!activePlanId) return;
    const updated = plans.map(p =>
      p.id === activePlanId
        ? {
            ...p,
            imageDataUrl: dataUrl,
            imageWidth: width,
            imageHeight: height,
            // reset calibration when the image changes — old px scale is meaningless
            calibration: null,
            updatedAt: Date.now(),
          }
        : p
    );
    savePlans(updated);
    set({ plans: updated });
  },

  startCalibration: () => {
    set({ mode: 'calibrate', pendingCalibrationPoint: null, selectedFurnitureId: null });
  },

  addCalibrationPoint: (p) => {
    set({ pendingCalibrationPoint: p });
  },

  clearCalibration: () => {
    const { plans, activePlanId } = get();
    if (!activePlanId) return;
    const updated = plans.map(p =>
      p.id === activePlanId ? { ...p, calibration: null, updatedAt: Date.now() } : p
    );
    savePlans(updated);
    set({ plans: updated, pendingCalibrationPoint: null });
  },

  cancelPendingCalibration: () => {
    set({ pendingCalibrationPoint: null, mode: 'select' });
  },

  beginPlacing: (template) => {
    set({ mode: 'placing', placingTemplate: template, selectedFurnitureId: null });
  },

  cancelPlacing: () => {
    set({ mode: 'select', placingTemplate: null });
  },

  placeFurnitureAt: (x, y) => {
    const { plans, activePlanId, placingTemplate } = get();
    if (!activePlanId || !placingTemplate) return;
    const item: FurnitureItem = {
      id: newId(),
      name: placingTemplate.name,
      x,
      y,
      widthMm: placingTemplate.widthMm,
      depthMm: placingTemplate.depthMm,
      heightMm: placingTemplate.heightMm,
      rotation: 0,
      source: 'manual',
      confidence: 'user-entered',
      color: FURNITURE_COLORS[Math.floor(Math.random() * FURNITURE_COLORS.length)],
    };
    const updated = plans.map(p =>
      p.id === activePlanId
        ? { ...p, furniture: [...p.furniture, item], updatedAt: Date.now() }
        : p
    );
    savePlans(updated);
    set({
      plans: updated,
      selectedFurnitureId: item.id,
      mode: 'select',
      placingTemplate: null,
    });
  },

  updateFurniture: (id, patch) => {
    const { plans, activePlanId } = get();
    if (!activePlanId) return;
    const updated = plans.map(p =>
      p.id === activePlanId
        ? {
            ...p,
            furniture: p.furniture.map(f => (f.id === id ? { ...f, ...patch } : f)),
            updatedAt: Date.now(),
          }
        : p
    );
    savePlans(updated);
    set({ plans: updated });
  },

  deleteFurniture: (id) => {
    const { plans, activePlanId, selectedFurnitureId } = get();
    if (!activePlanId) return;
    const updated = plans.map(p =>
      p.id === activePlanId
        ? { ...p, furniture: p.furniture.filter(f => f.id !== id), updatedAt: Date.now() }
        : p
    );
    savePlans(updated);
    set({
      plans: updated,
      selectedFurnitureId: selectedFurnitureId === id ? null : selectedFurnitureId,
    });
  },

  rotateFurniture: (id, deltaDeg) => {
    const { plans, activePlanId } = get();
    if (!activePlanId) return;
    const updated = plans.map(p =>
      p.id === activePlanId
        ? {
            ...p,
            furniture: p.furniture.map(f =>
              f.id === id ? { ...f, rotation: (f.rotation + deltaDeg + 360) % 360 } : f
            ),
            updatedAt: Date.now(),
          }
        : p
    );
    savePlans(updated);
    set({ plans: updated });
  },

  selectFurniture: (id) => set({ selectedFurnitureId: id }),

  setMode: (mode) => set({ mode, pendingCalibrationPoint: null, placingTemplate: null }),

  setUnits: (units) => {
    saveUnits(units);
    set({ units });
  },

  setImageElement: (el) => set({ imageElement: el }),
}));

/**
 * Helper called by the canvas when the user picks the second calibration point.
 * Lives outside the store interface to keep the action signature simple.
 */
export function commitCalibrationWithPoints(
  p1: Point,
  p2: Point,
  distanceMm: number
): Calibration | null {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const pxDist = Math.sqrt(dx * dx + dy * dy);
  if (pxDist <= 0 || distanceMm <= 0) return null;
  const calibration: Calibration = {
    points: [p1, p2],
    distanceMm,
    pxPerMm: pxDist / distanceMm,
  };
  const state = usePlanStore.getState();
  const { plans, activePlanId } = state;
  if (!activePlanId) return null;
  const updated = plans.map(p =>
    p.id === activePlanId ? { ...p, calibration, updatedAt: Date.now() } : p
  );
  savePlans(updated);
  usePlanStore.setState({
    plans: updated,
    pendingCalibrationPoint: null,
    mode: 'select',
  });
  return calibration;
}

/** Ensure there's always at least one plan to work in. */
export function ensureInitialPlan(): void {
  const { plans, createPlan } = usePlanStore.getState();
  if (plans.length === 0) createPlan('My first plan');
}
