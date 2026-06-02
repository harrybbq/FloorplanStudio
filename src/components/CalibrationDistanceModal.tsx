import { useEffect, useRef, useState } from 'react';
import type { UnitSystem } from '../types';
import { lengthPlaceholder, parseLength } from '../lib/units';

export function CalibrationDistanceModal({
  units,
  onCancel,
  onCommit,
}: {
  units: UnitSystem;
  onCancel: () => void;
  onCommit: (mm: number) => void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit() {
    const mm = parseLength(value, units);
    if (mm === null || mm <= 0) {
      setError("Couldn't read that distance. Try e.g. 1500 or 1.5m.");
      return;
    }
    onCommit(mm);
  }

  return (
    <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="panel w-[360px] p-5 shadow-lg">
        <h2 className="font-display text-lg mb-1">Set scale</h2>
        <p className="text-sm text-ink-mid mb-4">
          What's the real distance between those two points?
        </p>
        <input
          ref={inputRef}
          className="input"
          placeholder={lengthPlaceholder(units)}
          value={value}
          onChange={e => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') onCancel();
          }}
        />
        {error && <p className="text-xs text-amber mt-2">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={submit}>Set scale</button>
        </div>
      </div>
    </div>
  );
}
