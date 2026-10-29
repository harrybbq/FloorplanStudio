import { create } from 'zustand';
import type {
  Calibration,
  FurnitureItem,
  Mode,
  PlacingTemplate,
  Plan,
  Point,
  SavedFurniture,
  UnitSystem,
  Wall,
} from '../types';
import {
  loadActivePlanId,
  loadLibrary,
  loadPlans,
  loadUnits,
  saveActivePlanId,
  saveImage,
  saveLibrary,
  savePlans,
  saveUnits,
} from '../lib/storage';
import { flipShapeX } from '../lib/footprint';

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

function blankPlan(name: string): Plan {
  const now = Date.now();
  return {
    id: newId(),
    name,
    imageDataUrl: null,
    calibration: null,
    furniture: [],
    walls: [],
    createdAt: now,
    updatedAt: now,
  };
}

type DeletedFurniture = { planId: string; item: FurnitureItem; index: number };

interface PlanState {
  plans: Plan[];
  activePlanId: string | null;
  units: UnitSystem;
  mode: Mode;
  selectedFurnitureId: string | null;
  /** Calibration in progress: first click, then second click (which opens the distance dialog). */
  pendingCalibrationPoint: Point | null;
  pendingCalibrationSecond: Point | null;
  /** Furniture template currently being placed. */
  placingTemplate: PlacingTemplate | null;
  /** In-progress wall polyline (image-space points). */
  draftWallPoints: Point[];
  /** Cross-plan furniture library. */
  library: SavedFurniture[];
  /** The most recent delete, so it can be undone. */
  lastDeleted: DeletedFurniture | null;
  /** True when the last write to localStorage was refused (usually the quota). */
  saveFailed: boolean;

  active: () => Plan | null;

  // — plans —
  createPlan: (name?: string) => void;
  deletePlan: (id: string) => void;
  selectPlan: (id: string) => void;
  renamePlan: (id: string, name: string) => void;

  // — image —
  /** Replace the backdrop. Calibration resets unless one is supplied (e.g. the sample plan). */
  setPlanImage: (dataUrl: string, calibration?: Calibration | null) => void;
  clearPlanImage: () => void;

  // — calibration —
  startCalibration: () => void;
  /** First call sets point 1; the next (at least `minDist` px away) sets point 2. */
  addCalibrationPoint: (p: Point, minDist: number) => void;
  commitCalibration: (distanceMm: number) => boolean;
  clearCalibration: () => void;
  cancelPendingCalibration: () => void;

  // — furniture —
  beginPlacing: (template: PlacingTemplate) => void;
  cancelPlacing: () => void;
  placeFurnitureAt: (x: number, y: number) => void;
  updateFurniture: (id: string, patch: Partial<FurnitureItem> | ((f: FurnitureItem) => Partial<FurnitureItem>)) => void;
  deleteFurniture: (id: string) => void;
  /** Copy an item, offset by `offset` px, and select the copy. */
  duplicateFurniture: (id: string, offset: number) => void;
  undoDelete: () => void;
  dismissUndo: () => void;
  rotateFurniture: (id: string, deltaDeg: number) => void;
  flipFurniture: (id: string) => void;
  selectFurniture: (id: string | null) => void;

  // — walls —
  startWall: () => void;
  /** Ignores a point within `minDist` px of the previous one (e.g. a double-click). */
  addWallPoint: (p: Point, minDist: number) => void;
  finishWall: () => void;
  cancelWall: () => void;
  deleteWall: (id: string) => void;
  clearWalls: () => void;

  // — library —
  addToLibrary: (item: Omit<SavedFurniture, 'id'>) => void;
  removeFromLibrary: (id: string) => void;

  // — misc —
  setMode: (mode: Mode) => void;
  setUnits: (units: UnitSystem) => void;
}

/** Back to plain select mode, dropping any half-finished tool interaction. */
const IDLE = {
  mode: 'select' as Mode,
  pendingCalibrationPoint: null,
  pendingCalibrationSecond: null,
  placingTemplate: null,
  draftWallPoints: [] as Point[],
};

/** IDLE plus everything that belongs to the previous plan. */
const PLAN_SWITCH = { ...IDLE, selectedFurnitureId: null, lastDeleted: null };

const initialPlans = loadPlans();
const storedActiveId = loadActivePlanId();
const initialActiveId = initialPlans.some(p => p.id === storedActiveId)
  ? storedActiveId
  : initialPlans[0]?.id ?? null;

export const usePlanStore = create<PlanState>((set, get) => {
  /** Apply `fn` to the active plan, persist, and merge `extra` into state. */
  function mutateActive(fn: (p: Plan) => Plan, extra: Partial<PlanState> = {}): void {
    const { plans, activePlanId } = get();
    if (!activePlanId) return;
    const updated = plans.map(p => (p.id === activePlanId ? { ...fn(p), updatedAt: Date.now() } : p));
    set({ plans: updated, saveFailed: !savePlans(updated), ...extra });
  }

  return {
    plans: initialPlans,
    activePlanId: initialActiveId,
    units: loadUnits(),
    ...PLAN_SWITCH,
    library: loadLibrary(),
    saveFailed: false,

    active: () => {
      const { plans, activePlanId } = get();
      return plans.find(p => p.id === activePlanId) ?? null;
    },

    // — plans —
    createPlan: name => {
      const { plans } = get();
      const p = blankPlan(name ?? nextPlanName(plans));
      const updated = [...plans, p];
      saveActivePlanId(p.id);
      set({ plans: updated, activePlanId: p.id, saveFailed: !savePlans(updated), ...PLAN_SWITCH });
    },

    deletePlan: id => {
      const { plans, activePlanId } = get();
      const updated = plans.filter(p => p.id !== id);
      saveImage(id, null);
      const wasActive = activePlanId === id;
      const nextActive = wasActive ? updated[0]?.id ?? null : activePlanId;
      saveActivePlanId(nextActive);
      set({
        plans: updated,
        activePlanId: nextActive,
        saveFailed: !savePlans(updated),
        ...(wasActive ? PLAN_SWITCH : {}),
      });
    },

    selectPlan: id => {
      if (id === get().activePlanId) return;
      saveActivePlanId(id);
      set({ activePlanId: id, ...PLAN_SWITCH });
    },

    renamePlan: (id, name) => {
      const updated = get().plans.map(p => (p.id === id ? { ...p, name, updatedAt: Date.now() } : p));
      set({ plans: updated, saveFailed: !savePlans(updated) });
    },

    // — image —
    setPlanImage: (dataUrl, calibration = null) => {
      const id = get().activePlanId;
      if (!id) return;
      const imageSaved = saveImage(id, dataUrl);
      mutateActive(p => ({ ...p, imageDataUrl: dataUrl, calibration }), IDLE);
      if (!imageSaved) set({ saveFailed: true });
    },

    clearPlanImage: () => {
      const id = get().activePlanId;
      if (!id) return;
      saveImage(id, null);
      mutateActive(p => ({ ...p, imageDataUrl: null, calibration: null }), { ...IDLE, selectedFurnitureId: null });
    },

    // — calibration —
    startCalibration: () => set({ ...IDLE, mode: 'calibrate', selectedFurnitureId: null }),

    addCalibrationPoint: (p, minDist) => {
      const first = get().pendingCalibrationPoint;
      if (!first) set({ pendingCalibrationPoint: p });
      else if (Math.hypot(p.x - first.x, p.y - first.y) >= minDist) set({ pendingCalibrationSecond: p });
    },

    commitCalibration: distanceMm => {
      const { pendingCalibrationPoint: a, pendingCalibrationSecond: b } = get();
      if (!a || !b || !(distanceMm > 0)) return false;
      const px = Math.hypot(b.x - a.x, b.y - a.y);
      if (px <= 0) return false;
      mutateActive(p => ({ ...p, calibration: { points: [a, b], distanceMm, pxPerMm: px / distanceMm } }), IDLE);
      return true;
    },

    clearCalibration: () => mutateActive(p => ({ ...p, calibration: null }), IDLE),

    cancelPendingCalibration: () => set(IDLE),

    // — furniture —
    beginPlacing: template => set({ ...IDLE, mode: 'placing', placingTemplate: template, selectedFurnitureId: null }),

    cancelPlacing: () => set(IDLE),

    placeFurnitureAt: (x, y) => {
      const template = get().placingTemplate;
      if (!template) return;
      const item: FurnitureItem = {
        id: newId(),
        name: template.name,
        x,
        y,
        widthMm: template.widthMm,
        depthMm: template.depthMm,
        heightMm: template.heightMm,
        rotation: 0,
        shape: template.shape,
        source: template.source ?? 'manual',
        confidence: template.confidence ?? 'user-entered',
        color: template.color ?? FURNITURE_COLORS[Math.floor(Math.random() * FURNITURE_COLORS.length)],
      };
      mutateActive(p => ({ ...p, furniture: [...p.furniture, item] }), { ...IDLE, selectedFurnitureId: item.id });
    },

    updateFurniture: (id, patch) =>
      mutateActive(p => ({
        ...p,
        furniture: p.furniture.map(f => (f.id === id ? { ...f, ...(typeof patch === 'function' ? patch(f) : patch) } : f)),
      })),

    deleteFurniture: id => {
      const plan = get().active();
      const index = plan?.furniture.findIndex(f => f.id === id) ?? -1;
      if (!plan || index < 0) return;
      const { selectedFurnitureId } = get();
      mutateActive(p => ({ ...p, furniture: p.furniture.filter(f => f.id !== id) }), {
        selectedFurnitureId: selectedFurnitureId === id ? null : selectedFurnitureId,
        lastDeleted: { planId: plan.id, item: plan.furniture[index], index },
      });
    },

    duplicateFurniture: (id, offset) => {
      const source = get().active()?.furniture.find(f => f.id === id);
      if (!source) return;
      const copy: FurnitureItem = { ...source, id: newId(), x: source.x + offset, y: source.y + offset };
      mutateActive(p => ({ ...p, furniture: [...p.furniture, copy] }), { selectedFurnitureId: copy.id });
    },

    undoDelete: () => {
      const { lastDeleted, activePlanId } = get();
      if (!lastDeleted || lastDeleted.planId !== activePlanId) return set({ lastDeleted: null });
      mutateActive(
        p => {
          const furniture = [...p.furniture];
          furniture.splice(Math.min(lastDeleted.index, furniture.length), 0, lastDeleted.item);
          return { ...p, furniture };
        },
        { lastDeleted: null, selectedFurnitureId: lastDeleted.item.id }
      );
    },

    dismissUndo: () => set({ lastDeleted: null }),

    rotateFurniture: (id, deltaDeg) =>
      get().updateFurniture(id, f => ({ rotation: (((f.rotation + deltaDeg) % 360) + 360) % 360 })),

    flipFurniture: id => get().updateFurniture(id, f => ({ shape: flipShapeX(f.shape) })),

    selectFurniture: id => set({ selectedFurnitureId: id }),

    // — walls —
    startWall: () => set({ ...IDLE, mode: 'wall', selectedFurnitureId: null }),

    addWallPoint: (p, minDist) => {
      const pts = get().draftWallPoints;
      const last = pts[pts.length - 1];
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < minDist) return;
      set({ draftWallPoints: [...pts, p] });
    },

    finishWall: () => {
      const points = get().draftWallPoints;
      if (points.length < 2) return set(IDLE);
      const wall: Wall = { id: newId(), points };
      mutateActive(p => ({ ...p, walls: [...p.walls, wall] }), IDLE);
    },

    cancelWall: () => set(IDLE),

    deleteWall: id => mutateActive(p => ({ ...p, walls: p.walls.filter(w => w.id !== id) })),

    clearWalls: () => mutateActive(p => ({ ...p, walls: [] })),

    // — library —
    addToLibrary: item => {
      const { library } = get();
      const same = (l: SavedFurniture) =>
        l.name.toLowerCase() === item.name.toLowerCase() &&
        l.widthMm === item.widthMm &&
        l.depthMm === item.depthMm &&
        l.heightMm === item.heightMm &&
        JSON.stringify(l.shape ?? null) === JSON.stringify(item.shape ?? null);
      if (library.some(same)) return;
      const updated = [...library, { ...item, id: newId() }];
      set({ library: updated, saveFailed: !saveLibrary(updated) });
    },

    removeFromLibrary: id => {
      const updated = get().library.filter(l => l.id !== id);
      set({ library: updated, saveFailed: !saveLibrary(updated) });
    },

    // — misc —
    setMode: mode => set({ ...IDLE, mode }),

    setUnits: units => {
      saveUnits(units);
      set({ units });
    },
  };
});

/** "Plan N" using the lowest N not already taken. */
function nextPlanName(plans: Plan[]): string {
  const taken = new Set(plans.map(p => p.name));
  let n = plans.length + 1;
  for (let i = 1; i <= plans.length + 1; i++) {
    if (!taken.has(`Plan ${i}`)) {
      n = i;
      break;
    }
  }
  return `Plan ${n}`;
}

/** Ensure there's always at least one plan to work in. */
export function ensureInitialPlan(): void {
  const { plans, createPlan } = usePlanStore.getState();
  if (plans.length === 0) createPlan('My first plan');
}
