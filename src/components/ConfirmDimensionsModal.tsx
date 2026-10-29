import { useState } from 'react';
import type { FurnitureDimensions, PlacingTemplate, UnitSystem } from '../types';
import { toInputValue } from '../lib/units';
import { confidenceMeta, sourceLabel } from '../lib/furniture/provenance';
import { Modal } from './Modal';
import { DimensionFields, parseDimensions, TextField, type DimensionInputs } from './FormFields';

/**
 * Shown when a provider returns dimensions. The user always confirms (and can
 * edit) before placement. If they change a dimension, confidence drops to
 * 'user-entered' (they've taken ownership of the number) while the original
 * source is kept, so provenance stays honest ("catalog suggested, you corrected").
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
  const [initial] = useState<DimensionInputs>(() => ({
    width: toInputValue(result.widthMm, units),
    depth: toInputValue(result.depthMm, units),
    height: result.heightMm ? toInputValue(result.heightMm, units) : '',
  }));
  const [name, setName] = useState(result.name);
  const [dims, setDims] = useState<DimensionInputs>(initial);
  const [error, setError] = useState<string | null>(null);
  const meta = confidenceMeta(result.confidence);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Name is required.');
    const parsed = parseDimensions(dims, units);
    if (!parsed.ok) return setError(parsed.error);

    // Compare the text, not the parsed mm — a unit round-trip (e.g. 1650 mm →
    // "65.0" in → 1651 mm) must not count as the user editing it.
    const edited = dims.width !== initial.width || dims.depth !== initial.depth || dims.height !== initial.height;
    const value = edited ? parsed.value : { widthMm: result.widthMm, depthMm: result.depthMm, heightMm: result.heightMm };

    onConfirm({
      name: name.trim(),
      ...value,
      source: result.source,
      confidence: edited ? 'user-entered' : result.confidence,
    });
  }

  return (
    <Modal title="Confirm dimensions" onClose={onCancel} layer={60}>
      <form onSubmit={submit} className="p-5 pt-2 space-y-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-bg-overlay">
            <span className="w-2 h-2 rounded-full" style={{ background: meta.dot }} />
            {meta.label}
          </span>
          <span className="text-ink-muted">via {sourceLabel(result.source)}</span>
        </div>
        <p className="text-sm text-ink-mid">Check these against the real product before placing — edit anything that looks off.</p>
        <TextField label="Name" value={name} onChange={setName} />
        <DimensionFields units={units} value={dims} onChange={setDims} />
        {error && <p className="text-xs text-amber">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn" onClick={onCancel}>
            Back
          </button>
          <button type="submit" className="btn-primary" data-autofocus>
            Confirm &amp; place
          </button>
        </div>
      </form>
    </Modal>
  );
}
