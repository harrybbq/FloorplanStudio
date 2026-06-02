import { useEffect, useState } from 'react';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { FloorplanCanvas } from './components/FloorplanCanvas';
import { EmptyState } from './components/EmptyState';
import { AddFurnitureModal } from './components/AddFurnitureModal';
import { ensureInitialPlan, usePlanStore } from './state/planStore';

export default function App() {
  const plan = usePlanStore(s => s.active());
  const units = usePlanStore(s => s.units);
  const mode = usePlanStore(s => s.mode);
  const beginPlacing = usePlanStore(s => s.beginPlacing);
  const selectedId = usePlanStore(s => s.selectedFurnitureId);
  const deleteFurniture = usePlanStore(s => s.deleteFurniture);
  const rotateFurniture = usePlanStore(s => s.rotateFurniture);
  const startCalibration = usePlanStore(s => s.startCalibration);
  const setMode = usePlanStore(s => s.setMode);
  const cancelPlacing = usePlanStore(s => s.cancelPlacing);

  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    ensureInitialPlan();
  }, []);

  // Global shortcuts: V = select, C = calibrate, A = add furniture, Delete/Backspace = delete selected.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignore when typing in inputs.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === 'v' || e.key === 'V') {
        if (mode === 'placing') cancelPlacing();
        setMode('select');
      } else if ((e.key === 'c' || e.key === 'C') && plan?.imageDataUrl) {
        startCalibration();
      } else if ((e.key === 'a' || e.key === 'A') && plan?.calibration) {
        setAddOpen(true);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        deleteFurniture(selectedId);
      } else if ((e.key === 'r' || e.key === 'R') && selectedId) {
        rotateFurniture(selectedId, e.shiftKey ? -15 : 15);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, plan?.imageDataUrl, plan?.calibration, selectedId, setMode, cancelPlacing, startCalibration, deleteFurniture, rotateFurniture]);

  const showCanvas = !!plan?.imageDataUrl;

  return (
    <div className="h-screen w-screen flex flex-col">
      <Toolbar onAddFurniture={() => setAddOpen(true)} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 relative bg-bg-base overflow-hidden">
          {showCanvas ? <FloorplanCanvas /> : <EmptyState />}

          {/* Hint overlays for active modes */}
          {showCanvas && mode === 'calibrate' && (
            <ModeBanner>
              {usePlanStore.getState().pendingCalibrationPoint
                ? 'Click the second point — then enter the real distance.'
                : 'Click the first point of a known distance.'}
              <button
                className="ml-3 btn-ghost text-xs"
                onClick={() => usePlanStore.getState().cancelPendingCalibration()}
              >
                Cancel (Esc)
              </button>
            </ModeBanner>
          )}
          {showCanvas && mode === 'placing' && (
            <ModeBanner>
              Click on the plan to place. Esc to cancel.
            </ModeBanner>
          )}
          {showCanvas && mode === 'select' && !plan?.calibration && (
            <ModeBanner tone="warn">
              No scale set yet — calibrate before placing furniture.
            </ModeBanner>
          )}
        </main>
      </div>

      {addOpen && (
        <AddFurnitureModal
          units={units}
          onCancel={() => setAddOpen(false)}
          onConfirm={data => {
            beginPlacing(data);
            setAddOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ModeBanner({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' }) {
  const bg = tone === 'warn' ? 'bg-amber/90' : 'bg-em/90';
  return (
    <div className={`absolute top-4 left-1/2 -translate-x-1/2 ${bg} text-white text-sm px-4 py-2 rounded-full shadow-md flex items-center gap-2`}>
      {children}
    </div>
  );
}
