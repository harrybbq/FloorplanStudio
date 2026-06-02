import { useEffect, useMemo, useRef, useState } from 'react';
import type { FurniturePreset, PlacingTemplate, SavedFurniture, UnitSystem } from '../types';
import { formatLength, lengthPlaceholder, parseLength } from '../lib/units';
import { FURNITURE_PRESETS, PRESET_CATEGORIES } from '../lib/presets';
import { usePlanStore } from '../state/planStore';

type Tab = 'custom' | 'presets' | 'library';

/**
 * Unified "add furniture" surface. Three sources, one placement flow:
 *   - Custom:  type name + dimensions (optionally save to library)
 *   - Presets: pick from the built-in standard-size catalog
 *   - Library: re-place something saved earlier
 *
 * Picking an item calls beginPlacing() and closes — the user then clicks the
 * canvas to drop it. All measurements stay in mm internally.
 */
export function AddFurnitureModal({
  units,
  onClose,
}: {
  units: UnitSystem;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('custom');
  const library = usePlanStore(s => s.library);
  const beginPlacing = usePlanStore(s => s.beginPlacing);
  const addToLibrary = usePlanStore(s => s.addToLibrary);
  const removeFromLibrary = usePlanStore(s => s.removeFromLibrary);

  function place(template: PlacingTemplate) {
    beginPlacing(template);
    onClose();
  }

  return (
    <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="panel w-[460px] max-h-[80vh] flex flex-col shadow-lg">
        <div className="p-5 pb-0">
          <h2 className="font-display text-lg mb-3">Add furniture</h2>
          <div className="flex gap-1 border-b border-line">
            {(['custom', 'presets', 'library'] as Tab[]).map(t => (
              <button
                key={t}
                className={`px-3 py-2 text-sm font-medium capitalize -mb-px border-b-2 transition-colors ${
                  tab === t
                    ? 'border-em text-em'
                    : 'border-transparent text-ink-muted hover:text-ink-mid'
                }`}
                onClick={() => setTab(t)}
              >
                {t}
                {t === 'library' && library.length > 0 && (
                  <span className="ml-1 text-xs text-ink-muted">({library.length})</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 overflow-y-auto">
          {tab === 'custom' && (
            <CustomTab
              units={units}
              onPlace={place}
              onSaveToLibrary={item => addToLibrary({ ...item, source: 'manual', confidence: 'user-entered' })}
            />
          )}
          {tab === 'presets' && <PresetsTab units={units} onPlace={place} onSaveToLibrary={addToLibrary} />}
          {tab === 'library' && (
            <LibraryTab
              units={units}
              library={library}
              onPlace={place}
              onRemove={removeFromLibrary}
            />
          )}
        </div>

        <div className="p-4 border-t border-line flex justify-end">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Custom ──────────────────────────────────────────────────────────── */

function CustomTab({
  units,
  onPlace,
  onSaveToLibrary,
}: {
  units: UnitSystem;
  onPlace: (t: PlacingTemplate) => void;
  onSaveToLibrary: (item: { name: string; widthMm: number; depthMm: number; heightMm: number }) => void;
}) {
  const [name, setName] = useState('');
  const [width, setWidth] = useState('');
  const [depth, setDepth] = useState('');
  const [height, setHeight] = useState('');
  const [saveToLib, setSaveToLib] = useState(true);
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
    const data = { name: name.trim(), widthMm: w, depthMm: d, heightMm: h };
    if (saveToLib) onSaveToLibrary(data);
    onPlace(data);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-mid">Manual entry. After confirming, click on the plan to place it.</p>
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
      <label className="flex items-center gap-2 text-sm text-ink-mid cursor-pointer select-none">
        <input type="checkbox" checked={saveToLib} onChange={e => setSaveToLib(e.target.checked)} />
        Save to library for reuse
      </label>
      <div className="flex justify-end">
        <button className="btn-primary" onClick={submit}>
          Add &amp; place
        </button>
      </div>
    </div>
  );
}

/* ── Presets ─────────────────────────────────────────────────────────── */

function PresetsTab({
  units,
  onPlace,
  onSaveToLibrary,
}: {
  units: UnitSystem;
  onPlace: (t: PlacingTemplate) => void;
  onSaveToLibrary: (item: Omit<SavedFurniture, 'id'>) => void;
}) {
  const [category, setCategory] = useState<string>('All');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FURNITURE_PRESETS.filter(p => {
      if (category !== 'All' && p.category !== category) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [category, query]);

  return (
    <div className="space-y-3">
      <input
        className="input"
        placeholder="Search presets…"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      <div className="flex flex-wrap gap-1">
        {['All', ...PRESET_CATEGORIES].map(c => (
          <button
            key={c}
            className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
              category === c
                ? 'bg-em text-white border-em'
                : 'border-line text-ink-mid hover:bg-bg-overlay'
            }`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <ul className="space-y-1 max-h-[42vh] overflow-y-auto">
        {filtered.map(preset => (
          <PresetRow key={`${preset.category}-${preset.name}`} preset={preset} units={units} onPlace={onPlace} onSaveToLibrary={onSaveToLibrary} />
        ))}
        {filtered.length === 0 && <li className="text-sm text-ink-muted italic py-2">No presets match.</li>}
      </ul>
    </div>
  );
}

function PresetRow({
  preset,
  units,
  onPlace,
  onSaveToLibrary,
}: {
  preset: FurniturePreset;
  units: UnitSystem;
  onPlace: (t: PlacingTemplate) => void;
  onSaveToLibrary: (item: Omit<SavedFurniture, 'id'>) => void;
}) {
  return (
    <li className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-bg-overlay group">
      <button className="flex-1 text-left" onClick={() => onPlace(preset)}>
        <div className="text-sm font-medium">{preset.name}</div>
        <div className="text-xs text-ink-muted">
          {formatLength(preset.widthMm, units)} × {formatLength(preset.depthMm, units)}
        </div>
      </button>
      <button
        className="btn-ghost text-xs opacity-0 group-hover:opacity-100"
        title="Save to library"
        onClick={() => onSaveToLibrary({ ...preset, source: 'manual', confidence: 'user-entered' })}
      >
        + lib
      </button>
      <button className="btn-primary !px-2 !py-1 text-xs" onClick={() => onPlace(preset)}>
        Place
      </button>
    </li>
  );
}

/* ── Library ─────────────────────────────────────────────────────────── */

function LibraryTab({
  units,
  library,
  onPlace,
  onRemove,
}: {
  units: UnitSystem;
  library: SavedFurniture[];
  onPlace: (t: PlacingTemplate) => void;
  onRemove: (id: string) => void;
}) {
  if (library.length === 0) {
    return (
      <p className="text-sm text-ink-muted italic py-4 text-center">
        Your library is empty. Add custom furniture with “Save to library” ticked, or save a preset.
      </p>
    );
  }
  return (
    <ul className="space-y-1 max-h-[52vh] overflow-y-auto">
      {library.map(item => (
        <li key={item.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-bg-overlay group">
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: item.color ?? '#8b7355' }} />
          <button
            className="flex-1 text-left"
            onClick={() => onPlace({ ...item, source: item.source, confidence: item.confidence })}
          >
            <div className="text-sm font-medium">{item.name}</div>
            <div className="text-xs text-ink-muted">
              {formatLength(item.widthMm, units)} × {formatLength(item.depthMm, units)}
            </div>
          </button>
          <button
            className="btn-ghost text-xs opacity-0 group-hover:opacity-100 !text-amber"
            title="Remove from library"
            onClick={() => onRemove(item.id)}
          >
            ✕
          </button>
          <button
            className="btn-primary !px-2 !py-1 text-xs"
            onClick={() => onPlace({ ...item, source: item.source, confidence: item.confidence })}
          >
            Place
          </button>
        </li>
      ))}
    </ul>
  );
}
