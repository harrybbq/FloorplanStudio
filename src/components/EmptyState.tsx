import { useRef } from 'react';
import { usePlanStore } from '../state/planStore';
import { useImageImport } from '../state/useImageImport';
import { createSamplePlan } from '../lib/samplePlan';

/**
 * Shown when the active plan has no image. Paste and drag-drop are handled
 * app-wide (App.tsx), so they also work once an image is loaded.
 */
export function EmptyState() {
  const importImage = useImageImport();
  const setPlanImage = usePlanStore(s => s.setPlanImage);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function loadSample() {
    const { dataUrl, calibration } = createSamplePlan();
    setPlanImage(dataUrl, calibration);
  }

  return (
    <div className="w-full h-full flex items-center justify-center p-8">
      <div className="panel max-w-md w-full p-10 text-center border-dashed border-2">
        <h2 className="font-display text-2xl text-em mb-2">Drop a floorplan</h2>
        <p className="text-ink-mid text-sm mb-5">
          Paste an image (<kbd className="px-1.5 py-0.5 bg-bg-overlay border border-line rounded text-xs font-mono">Ctrl/⌘+V</kbd>),
          drag a file here, or click below.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) void importImage(f);
            e.target.value = '';
          }}
        />
        <div className="flex justify-center gap-2">
          <button className="btn-primary" onClick={() => inputRef.current?.click()}>
            Choose image
          </button>
          <button className="btn" onClick={loadSample}>
            Try a sample plan
          </button>
        </div>
        <p className="text-xs text-ink-muted mt-6">Next: click two points on a known distance to set the scale.</p>
      </div>
    </div>
  );
}
