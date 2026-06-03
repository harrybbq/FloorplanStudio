import { useState } from 'react';
import type { FurnitureDimensions, PlacingTemplate, UnitSystem } from '../types';
import { lengthPlaceholder, parseLength } from '../lib/units';
import { confidenceMeta, sourceLabel } from '../lib/furniture/provenance';

/**
 * Shown when a provider returns dimensions. The user always confirms (and can
 * edit) before placement. If they change any dimension, we downgrade confidence
 * to 'user-entered' (they've taken ownership of the number) while keeping the
 * original source, so provenance stays honest ("AI suggested, you corrected").
 */
export function ConfirmDimensionsModal({
  result,
  units,
  onCancel,
  onConfirm,
}: {
  result: FurnitureDimensions;
  units: UnitSystem;
  onCancel: () => void;
  onConfirm: (template: PlacingTemplate) => void;
}) {
  const [name, setName] = useState(result.name);
  const [width, setWidth] = useState(formatInput(result.widthMm, units));
  const [depth, setDepth] = useState(formatInput(result.depthMm, units));
  const [height, setHeight] = useState(result.heightMm ? formatInput(result.heightMm, units) : '');
  const [error, setError] = useState<string | null>(null);

  const meta = confidenceMeta(result.confidence);

  function submit() {
    const w = parseLength(width, units);
    const d = parseLength(depth, units);
    const h = height ? parseLength(height, units) : 0;
    if (!name.trim()) return setError('Name is required.');
    if (w === null || w <= 0) return setError('Width is required.');
    if (d === null || d <= 0) return setError('Depth is required.');
    if (h === null) return setError("Couldn't read the height.");

    // Did the user change the suggested numbers? If so, it's their value now.
    const edited =
      Math.round(w) !== Math.round(result.widthMm) ||
      Math.round(d) !== Math.round(result.depthMm) ||
      Math.round(h) !== Math.round(result.heightMm);

    onConfirm({
      name: name.trim(),
      widthMm: w,
      depthMm: d,
      heightMm: h,
      source: result.source,
      confidence: edited ? 'user-entered' : result.confidence,
    });
  }

  return (
    <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-[60]">
      <div className="panel w-[400px] p-5 shadow-lg">
        <h2 className="font-display text-lg mb-1">Confirm dimensions</h2>
        <div className="flex items-center gap-2 mb-4 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-bg-overlay">
            <span className="w-2 h-2 rounded-full" style={{ background: meta.dot }} />
            {meta.label}
          </span>
          <span className="text-ink-muted">via {sourceLabel(result.source)}</span>
        </div>
        <p className="text-sm text-ink-mid mb-4">
          Check these against the real product before placing — edit anything that looks off.
        </p>

        <div className="space-y-3">
          <div>
            <label className="label block mb-1">Name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label block mb-1">Width</label>
              <input className="input" placeholder={lengthPlaceholder(units)} value={width} onChange={e => setWidth(e.target.value)} />
            </div>
            <div>
              <label className="label block mb-1">Depth</label>
              <input className="input" placeholder={lengthPlaceholder(units)} value={depth} onChange={e => setDepth(e.target.value)} />
            </div>
            <div>
              <label className="label block mb-1">Height</label>
              <input className="input" placeholder="optional" value={height} onChange={e => setHeight(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-xs text-amber">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button className="btn" onClick={onCancel}>Back</button>
          <button className="btn-primary" onClick={submit}>Confirm &amp; place</button>
        </div>
      </div>
    </div>
  );
}

/** Pre-fill an input with the value in the user's current unit system (no unit suffix). */
function formatInput(mm: number, units: UnitSystem): string {
  if (units === 'metric') return String(Math.round(mm));
  // imperial: show inches to 1dp (parseLength reads a bare number as inches in imperial)
  return (mm / 25.4).toFixed(1);
}
