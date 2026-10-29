import { useId } from 'react';
import type { FurnitureShape, UnitSystem } from '../types';
import { lengthPlaceholder, parseLength } from '../lib/units';

export type DimensionInputs = { width: string; depth: string; height: string };
export type Dimensions = { widthMm: number; depthMm: number; heightMm: number };

export const EMPTY_DIMENSIONS: DimensionInputs = { width: '', depth: '', height: '' };

/** Validate W/D/H text inputs. Width and depth are required; height is optional. */
export function parseDimensions(
  inputs: DimensionInputs,
  units: UnitSystem
): { ok: true; value: Dimensions } | { ok: false; error: string } {
  const widthMm = parseLength(inputs.width, units);
  const depthMm = parseLength(inputs.depth, units);
  const heightMm = inputs.height.trim() ? parseLength(inputs.height, units) : 0;
  if (widthMm === null || widthMm <= 0) return { ok: false, error: `Width is required (${lengthPlaceholder(units)}).` };
  if (depthMm === null || depthMm <= 0) return { ok: false, error: 'Depth is required.' };
  if (heightMm === null) return { ok: false, error: "Couldn't read the height." };
  return { ok: true, value: { widthMm, depthMm, heightMm } };
}

/** The Width / Depth / Height input row used by every furniture form. */
export function DimensionFields({
  units,
  value,
  onChange,
}: {
  units: UnitSystem;
  value: DimensionInputs;
  onChange: (next: DimensionInputs) => void;
}) {
  const id = useId();
  const field = (key: keyof DimensionInputs, label: string, placeholder: string) => (
    <div>
      <label htmlFor={`${id}-${key}`} className="label block mb-1">
        {label}
      </label>
      <input
        id={`${id}-${key}`}
        className="input"
        inputMode="decimal"
        placeholder={placeholder}
        value={value[key]}
        onChange={e => onChange({ ...value, [key]: e.target.value })}
      />
    </div>
  );
  return (
    <div className="grid grid-cols-3 gap-2">
      {field('width', 'Width', lengthPlaceholder(units))}
      {field('depth', 'Depth', lengthPlaceholder(units))}
      {field('height', 'Height', 'optional')}
    </div>
  );
}

/** A labelled text input. */
export function TextField({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="label block mb-1">
        {label}
      </label>
      <input
        id={id}
        className="input"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        data-autofocus={autoFocus || undefined}
      />
    </div>
  );
}

/** A piece the user defined themselves (Custom tab or Maker). */
export type ManualItem = Dimensions & { name: string; shape?: FurnitureShape };

/** "Save to library" checkbox shared by the Custom and Maker tabs. */
export function SaveToLibraryCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-mid cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      Save to library for reuse
    </label>
  );
}
