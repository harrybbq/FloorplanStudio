import { useRef } from 'react';
import { usePlanStore } from '../state/planStore';

export function Toolbar({ onAddFurniture }: { onAddFurniture: () => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  const plan = usePlanStore(s => s.active());
  const mode = usePlanStore(s => s.mode);
  const units = usePlanStore(s => s.units);
  const setUnits = usePlanStore(s => s.setUnits);
  const setMode = usePlanStore(s => s.setMode);
  const startCalibration = usePlanStore(s => s.startCalibration);
  const clearCalibration = usePlanStore(s => s.clearCalibration);
  const startWall = usePlanStore(s => s.startWall);
  const setPlanImage = usePlanStore(s => s.setPlanImage);
  const clearPlanImage = usePlanStore(s => s.clearPlanImage);
  const cancelPlacing = usePlanStore(s => s.cancelPlacing);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new window.Image();
      img.onload = () => setPlanImage(dataUrl, img.naturalWidth, img.naturalHeight);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  const hasCalibration = !!plan?.calibration;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 panel rounded-none border-l-0 border-r-0 border-t-0">
      <div className="flex items-center gap-2">
        <span className="font-display font-bold text-base text-em">FloorplanStudio</span>
        <span className="text-ink-muted text-sm">·</span>
        <span className="text-sm text-ink-mid truncate max-w-[280px]">
          {plan?.name ?? 'No plan'}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          className={`btn ${mode === 'select' ? 'btn-active' : ''}`}
          onClick={() => {
            if (mode === 'placing') cancelPlacing();
            setMode('select');
          }}
          title="Select / move (V)"
        >
          Select
        </button>

        <button
          className={`btn ${mode === 'calibrate' ? 'btn-active' : ''}`}
          onClick={startCalibration}
          disabled={!plan?.imageDataUrl}
          title="Calibrate scale (C)"
        >
          {hasCalibration ? 'Recalibrate' : 'Calibrate'}
        </button>

        {hasCalibration && (
          <button
            className="btn-ghost text-xs"
            onClick={clearCalibration}
            title="Clear current calibration"
          >
            Clear
          </button>
        )}

        <button
          className={`btn ${mode === 'wall' ? 'btn-active' : ''}`}
          onClick={startWall}
          disabled={!plan?.imageDataUrl}
          title="Trace walls (W)"
        >
          Wall
        </button>

        <button
          className="btn-primary"
          disabled={!hasCalibration}
          onClick={onAddFurniture}
          title={hasCalibration ? 'Add furniture (A)' : 'Calibrate first to add furniture'}
        >
          + Furniture
        </button>
      </div>

      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
        <button className="btn" onClick={() => fileRef.current?.click()}>
          {plan?.imageDataUrl ? 'Replace image' : 'Upload image'}
        </button>

        {plan?.imageDataUrl && (
          <button
            className="btn !text-amber !border-amber/30 hover:!bg-amber/10"
            onClick={() => {
              if (confirm('Delete the floorplan image? Furniture stays, but the backdrop and scale are removed.')) {
                clearPlanImage();
              }
            }}
          >
            Delete image
          </button>
        )}

        <div className="flex items-center rounded-md border border-line overflow-hidden">
          <button
            className={`px-2 py-1 text-xs font-medium ${units === 'metric' ? 'bg-em text-white' : 'text-ink-mid hover:bg-bg-overlay'}`}
            onClick={() => setUnits('metric')}
          >
            mm
          </button>
          <button
            className={`px-2 py-1 text-xs font-medium ${units === 'imperial' ? 'bg-em text-white' : 'text-ink-mid hover:bg-bg-overlay'}`}
            onClick={() => setUnits('imperial')}
          >
            in
          </button>
        </div>
      </div>
    </div>
  );
}
