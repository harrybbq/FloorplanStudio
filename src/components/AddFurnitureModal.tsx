import { useEffect, useRef, useState } from 'react';
import type { UnitSystem } from '../types';
import { lengthPlaceholder, parseLength } from '../lib/units';

export function AddFurnitureModal({
  units,
  onCancel,
  onConfirm,
}: {
  units: UnitSystem;
  onCancel: () => void;
  onConfirm: (data: { name: string; widthMm: number; depthMm: number; heightMm: number }) => void;
}) {
  const [name, setName] = useState('');
  const [width, setWidth] = useState('');
  const [depth, setDepth] = useState('');
  const [height, setHeight] = useState('');
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  function submit() {
    const w = parseLength(width, units);
    const d = parseLength(depth, units);
    const h = height ? parseLength(height, units) : 0;
    if (!name.trim()) return setError('Give it a name.');
    if (w === null || w <= 0) return setError('Width is required (e.g. 1500 or 1.5m).');
    if (d === null || d <= 0) return setError('Depth is required.');
    if (h === null) return setError("Couldn't read the height.");
    onConfirm({ name: name.trim(), widthMm: w, depthMm: d, heightMm: h });
  }

  return (
    <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="panel w-[400px] p-5 shadow-lg">
        <h2 className="font-display text-lg mb-1">Add furniture</h2>
        <p className="text-sm text-ink-mid mb-4">
          Manual entry. After confirming, click on the plan to place it.
        </p>
        <div className="space-y-3">
          <div>
            <label className="label block mb-1">Name</label>
            <input
              ref={nameRef}
              className="input"
              placeholder="e.g. Malm dresser"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label block mb-1">Width</label>
              <input
                className="input"
                placeholder={lengthPlaceholder(units)}
                value={width}
                onChange={e => setWidth(e.target.value)}
              />
            </div>
            <div>
              <label className="label block mb-1">Depth</label>
              <input
                className="input"
                placeholder={lengthPlaceholder(units)}
                value={depth}
                onChange={e => setDepth(e.target.value)}
              />
            </div>
            <div>
              <label className="label block mb-1">Height</label>
              <input
                className="input"
                placeholder="optional"
                value={height}
                onChange={e => setHeight(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-xs text-amber">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={submit}>Add & place</button>
        </div>
      </div>
    </div>
  );
}
