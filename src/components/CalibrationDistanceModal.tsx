import { useState } from 'react';
import type { UnitSystem } from '../types';
import { lengthPlaceholder, parseLength } from '../lib/units';
import { Modal } from './Modal';
import { TextField } from './FormFields';

export function CalibrationDistanceModal({
  units,
  onCancel,
  onCommit,
}: {
  units: UnitSystem;
  onCancel: () => void;
  onCommit: (mm: number) => boolean;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const mm = parseLength(value, units);
    if (mm === null || mm <= 0) return setError(`Couldn't read that distance. Try ${lengthPlaceholder(units)}.`);
    if (!onCommit(mm)) setError('Those two points are too close together — cancel and pick them again.');
  }

  return (
    <Modal title="Set scale" onClose={onCancel} width={360}>
      <form onSubmit={submit} className="p-5 pt-2 space-y-3">
        <p className="text-sm text-ink-mid">What's the real distance between those two points?</p>
        <TextField
          label="Distance"
          value={value}
          onChange={v => {
            setValue(v);
            setError(null);
          }}
          placeholder={lengthPlaceholder(units)}
          autoFocus
        />
        {error && <p className="text-xs text-amber">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Set scale
          </button>
        </div>
      </form>
    </Modal>
  );
}
