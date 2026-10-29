import { useEffect, useState, type ReactNode } from 'react';
import { Toolbar } from './components/Toolbar';
import { DUPLICATE_OFFSET_MM, Sidebar } from './components/Sidebar';
import { FloorplanCanvas } from './components/FloorplanCanvas';
import { EmptyState } from './components/EmptyState';
import { AddFurnitureModal } from './components/AddFurnitureModal';
import { ensureInitialPlan, usePlanStore } from './state/planStore';
import { useImageImport } from './state/useImageImport';
import { useHouseHunterHandoff, type HandoffStatus } from './state/useHouseHunterHandoff';
import { imageFromItems } from './lib/image';

const NUDGE_MM = 10;
const NUDGE_FAST_MM = 100;
const UNDO_TOAST_MS = 6000;

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

export default function App() {
  const plan = usePlanStore(s => s.active());
  const units = usePlanStore(s => s.units);
  const mode = usePlanStore(s => s.mode);
  const hasFirstCalibrationPoint = usePlanStore(s => !!s.pendingCalibrationPoint);
  const draftCount = usePlanStore(s => s.draftPoints.length);
  const saveFailed = usePlanStore(s => s.saveFailed);
  const finishWall = usePlanStore(s => s.finishWall);
  const finishRoom = usePlanStore(s => s.finishRoom);
  const setMode = usePlanStore(s => s.setMode);
  const importImage = useImageImport();

  const [addOpen, setAddOpen] = useState(false);
  const [handoff, dismissHandoff] = useHouseHunterHandoff();

  useEffect(ensureInitialPlan, []);

  // Global shortcuts. State is read at key time, so this registers once.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const s = usePlanStore.getState();
      const cmd = e.ctrlKey || e.metaKey;

      if (cmd && !e.shiftKey && e.key.toLowerCase() === 'z' && s.lastDeleted && !isTyping(e.target)) {
        e.preventDefault();
        s.undoDelete();
        return;
      }
      // Leave browser/OS shortcuts (Ctrl+C, Ctrl+R…), dialogs and text fields alone.
      if (cmd || e.altKey || isTyping(e.target) || document.querySelector('[aria-modal="true"]')) return;

      const p = s.active();
      const sel = s.selectedFurnitureId;
      const pxPerMm = p?.calibration?.pxPerMm ?? 0;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      if (key === 'Escape') {
        if (s.mode !== 'select') s.setMode('select');
        else s.selectFurniture(null);
      } else if (key === 'Enter' && (s.mode === 'wall' || s.mode === 'room')) {
        e.preventDefault(); // don't also "click" a focused toolbar button
        if (s.mode === 'wall') s.finishWall();
        else s.finishRoom();
      } else if (key === 'v') {
        s.setMode('select');
      } else if (key === 'c' && p?.imageDataUrl) {
        s.startCalibration();
      } else if (key === 'w' && p?.imageDataUrl) {
        s.startWall();
      } else if (key === 'm' && p?.imageDataUrl) {
        s.startRoom();
      } else if (key === 'a' && p?.calibration) {
        setAddOpen(true);
      } else if (sel && (key === 'Delete' || key === 'Backspace')) {
        e.preventDefault();
        s.deleteFurniture(sel);
      } else if (sel && key === 'r') {
        s.rotateFurniture(sel, e.shiftKey ? -15 : 15);
      } else if (sel && key === 'f') {
        s.flipFurniture(sel);
      } else if (sel && key === 'd' && pxPerMm) {
        s.duplicateFurniture(sel, DUPLICATE_OFFSET_MM * pxPerMm);
      } else if (sel && pxPerMm && key.startsWith('Arrow')) {
        e.preventDefault();
        const step = (e.shiftKey ? NUDGE_FAST_MM : NUDGE_MM) * pxPerMm;
        const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
        const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
        s.updateFurniture(sel, f => ({ x: f.x + dx, y: f.y + dy }));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Paste an image anywhere (not into a text field) to load or replace the floorplan.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (isTyping(e.target)) return;
      const file = imageFromItems(e.clipboardData?.items);
      if (file) {
        e.preventDefault();
        void importImage(file);
      }
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [importImage]);

  const showCanvas = !!plan?.imageDataUrl;

  return (
    <div
      className="h-screen w-screen flex flex-col"
      onDragOver={e => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={e => {
        const file = imageFromItems(e.dataTransfer.items);
        if (file) {
          e.preventDefault();
          void importImage(file);
        }
      }}
    >
      <Toolbar onAddFurniture={() => setAddOpen(true)} />
      {saveFailed && (
        <div className="bg-danger text-white text-sm px-4 py-2 text-center" role="alert">
          Changes aren't being saved — browser storage is full. Delete an unused plan or use a smaller image.
        </div>
      )}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 relative bg-bg-base overflow-hidden">
          {showCanvas ? <FloorplanCanvas /> : <EmptyState />}

          {showCanvas && mode === 'calibrate' && (
            <ModeBanner>
              {hasFirstCalibrationPoint
                ? 'Click the second point — then enter the real distance.'
                : 'Click the first point of a known distance.'}
              <BannerButton onClick={() => setMode('select')}>Cancel (Esc)</BannerButton>
            </ModeBanner>
          )}
          {showCanvas && mode === 'placing' && <ModeBanner>Click on the plan to place. Esc to cancel.</ModeBanner>}
          {showCanvas && mode === 'wall' && (
            <ModeBanner>
              Click to trace a wall ({draftCount} {draftCount === 1 ? 'point' : 'points'}). Double-click or Enter to finish.
              <BannerButton onClick={finishWall}>Finish</BannerButton>
              <BannerButton onClick={() => setMode('select')}>Cancel (Esc)</BannerButton>
            </ModeBanner>
          )}
          {showCanvas && mode === 'room' && (
            <ModeBanner>
              Click the room's corners ({draftCount} so far). Click the first corner, double-click or Enter to close.
              <BannerButton onClick={finishRoom}>Close</BannerButton>
              <BannerButton onClick={() => setMode('select')}>Cancel (Esc)</BannerButton>
            </ModeBanner>
          )}
          {showCanvas && mode === 'select' && !plan?.calibration && (
            <ModeBanner tone="warn">No scale set yet — calibrate before placing furniture.</ModeBanner>
          )}

          {handoff && handoff.planId === plan?.id && !plan.imageDataUrl && (
            <HandoffBanner status={handoff} onDismiss={dismissHandoff} />
          )}

          <UndoToast />
        </main>
      </div>

      {addOpen && <AddFurnitureModal units={units} onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function ModeBanner({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  const bg = tone === 'warn' ? 'bg-amber/90' : 'bg-em/90';
  return (
    <div
      className={`absolute top-4 left-1/2 -translate-x-1/2 ${bg} text-white text-sm px-4 py-2 rounded-full shadow-md flex items-center gap-2`}
      role="status"
    >
      {children}
    </div>
  );
}

function BannerButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button className="btn-ghost text-xs !text-white hover:!bg-white/15" onClick={onClick}>
      {children}
    </button>
  );
}

/** Progress of a floorplan coming from HouseHunter, or how to finish by hand. */
function HandoffBanner({ status, onDismiss }: { status: NonNullable<HandoffStatus>; onDismiss: () => void }) {
  if (status.state === 'loading') return <ModeBanner>Fetching the floorplan from HouseHunter…</ModeBanner>;
  return (
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 w-[min(32rem,calc(100%-2rem))] panel shadow-md px-4 py-3 text-sm flex items-start gap-3"
      role="alert"
    >
      <p className="flex-1">
        Couldn't fetch the floorplan automatically (is HouseHunter's local app running?).{' '}
        <a className="text-em font-medium underline" href={status.floorplanUrl} target="_blank" rel="noreferrer noopener">
          Open the floorplan ↗
        </a>
        , copy the image, then press <kbd>Ctrl+V</kbd> here.
      </p>
      <button className="btn-ghost text-xs" onClick={onDismiss} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}

/** "Deleted X — Undo", shown briefly after any furniture delete. */
function UndoToast() {
  const lastDeleted = usePlanStore(s => s.lastDeleted);
  const undoDelete = usePlanStore(s => s.undoDelete);
  const dismissUndo = usePlanStore(s => s.dismissUndo);

  useEffect(() => {
    if (!lastDeleted) return;
    const t = setTimeout(dismissUndo, UNDO_TOAST_MS);
    return () => clearTimeout(t);
  }, [lastDeleted, dismissUndo]);

  if (!lastDeleted) return null;
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 panel shadow-md px-4 py-2 text-sm flex items-center gap-3" role="status">
      <span>
        Deleted <span className="font-medium">{lastDeleted.item.name}</span>
      </span>
      <button className="btn-ghost text-xs !text-em font-semibold" onClick={undoDelete}>
        Undo (Ctrl+Z)
      </button>
    </div>
  );
}
