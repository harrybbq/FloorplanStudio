import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  FurnitureDimensions,
  FurniturePreset,
  FurnitureShape,
  LShapeCorner,
  PlacingTemplate,
  SavedFurniture,
  UnitSystem,
} from '../types';
import { formatLength, lengthPlaceholder, parseLength } from '../lib/units';
import { FURNITURE_PRESETS, PRESET_CATEGORIES } from '../lib/presets';
import { defaultRegistry } from '../lib/furniture/providers';
import { usePlanStore } from '../state/planStore';
import { ConfirmDimensionsModal } from './ConfirmDimensionsModal';
import { MakerTab } from './MakerTab';
import { Modal } from './Modal';
import { Segmented } from './Segmented';
import { DimensionFields, EMPTY_DIMENSIONS, parseDimensions, SaveToLibraryCheckbox, TextField, type ManualItem } from './FormFields';

type Tab = 'custom' | 'presets' | 'maker' | 'lookup' | 'library';
const TABS: { id: Tab; label: string }[] = [
  { id: 'custom', label: 'Custom' },
  { id: 'presets', label: 'Presets' },
  { id: 'maker', label: 'Maker' },
  { id: 'lookup', label: 'Lookup' },
  { id: 'library', label: 'Library' },
];

/**
 * One "add furniture" surface, five sources, one placement flow:
 *   Custom (type dimensions) · Presets (standard sizes) · Maker (draw a shape) ·
 *   Lookup (product catalog → confirm step) · Library (re-use a saved piece)
 *
 * Picking an item calls beginPlacing() and closes — the user then clicks the
 * canvas to drop it. Tabs stay mounted so a half-filled form or half-drawn
 * shape survives switching tabs.
 */
export function AddFurnitureModal({ units, onClose }: { units: UnitSystem; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('custom');
  const [confirming, setConfirming] = useState<FurnitureDimensions | null>(null);
  const [prefillName, setPrefillName] = useState('');
  const library = usePlanStore(s => s.library);
  const beginPlacing = usePlanStore(s => s.beginPlacing);
  const addToLibrary = usePlanStore(s => s.addToLibrary);
  const removeFromLibrary = usePlanStore(s => s.removeFromLibrary);
  const panels = useRef<Partial<Record<Tab, HTMLDivElement | null>>>({});

  // Move focus into the newly shown tab.
  useEffect(() => {
    panels.current[tab]?.querySelector<HTMLElement>('input, button')?.focus();
  }, [tab]);

  function place(template: PlacingTemplate) {
    beginPlacing(template);
    onClose();
  }

  const saveManual = (item: ManualItem) => addToLibrary({ ...item, source: 'manual', confidence: 'user-entered' });

  return (
    <>
      <Modal title="Add furniture" onClose={onClose} width={480}>
        <div role="tablist" aria-label="Furniture source" className="flex gap-1 border-b border-line px-5 mt-3">
          {TABS.map(t => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              className={`px-3 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
                tab === t.id ? 'border-em text-em' : 'border-transparent text-ink-muted hover:text-ink-mid'
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === 'library' && library.length > 0 && <span className="ml-1 text-xs text-ink-muted">({library.length})</span>}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto">
          {TABS.map(t => (
            <div
              key={t.id}
              ref={el => {
                panels.current[t.id] = el;
              }}
              id={`panel-${t.id}`}
              role="tabpanel"
              aria-labelledby={`tab-${t.id}`}
              hidden={tab !== t.id}
            >
              {t.id === 'custom' && <CustomTab units={units} initialName={prefillName} onPlace={place} onSaveToLibrary={saveManual} />}
              {t.id === 'presets' && <PresetsTab units={units} onPlace={place} onSaveToLibrary={addToLibrary} />}
              {t.id === 'maker' && <MakerTab units={units} onPlace={place} onSaveToLibrary={saveManual} />}
              {t.id === 'lookup' && (
                <LookupTab
                  onResult={setConfirming}
                  onManual={q => {
                    setPrefillName(q);
                    setTab('custom');
                  }}
                />
              )}
              {t.id === 'library' && <LibraryTab units={units} library={library} onPlace={place} onRemove={removeFromLibrary} />}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-line flex justify-end">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </Modal>

      {confirming && (
        <ConfirmDimensionsModal result={confirming} units={units} onCancel={() => setConfirming(null)} onConfirm={place} />
      )}
    </>
  );
}

/* ── Custom ──────────────────────────────────────────────────────────── */

function CustomTab({
  units,
  initialName,
  onPlace,
  onSaveToLibrary,
}: {
  units: UnitSystem;
  initialName: string;
  onPlace: (t: PlacingTemplate) => void;
  onSaveToLibrary: (item: ManualItem) => void;
}) {
  const [name, setName] = useState(initialName);
  const [dims, setDims] = useState(EMPTY_DIMENSIONS);
  const [shapeKind, setShapeKind] = useState<'rect' | 'lshape'>('rect');
  const [cutCorner, setCutCorner] = useState<LShapeCorner>('tr');
  const [arm, setArm] = useState('');
  const [saveToLib, setSaveToLib] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // "Enter manually" from the Lookup tab hands its query over as the name.
  useEffect(() => {
    if (initialName) setName(initialName);
  }, [initialName]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Give it a name.');
    const parsed = parseDimensions(dims, units);
    if (!parsed.ok) return setError(parsed.error);
    const { widthMm, depthMm } = parsed.value;

    let shape: FurnitureShape | undefined;
    if (shapeKind === 'lshape') {
      const a = parseLength(arm, units);
      if (a === null || a <= 0) return setError('Enter the L arm thickness.');
      if (a >= Math.min(widthMm, depthMm)) return setError('Arm thickness must be less than both width and depth.');
      shape = { kind: 'lshape', cutCorner, armThicknessMm: a };
    }

    const item: ManualItem = { name: name.trim(), ...parsed.value, shape };
    if (saveToLib) onSaveToLibrary(item);
    onPlace(item);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-ink-mid">Manual entry. After confirming, click on the plan to place it.</p>
      <TextField label="Name" value={name} onChange={setName} placeholder="e.g. Malm dresser" />
      <DimensionFields units={units} value={dims} onChange={setDims} />

      <div>
        <span className="label block mb-1">Shape</span>
        <Segmented
          label="Shape"
          value={shapeKind}
          onChange={setShapeKind}
          options={[
            { value: 'rect', label: 'Rectangle' },
            { value: 'lshape', label: 'L-shape' },
          ]}
        />
      </div>

      {shapeKind === 'lshape' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="custom-cut" className="label block mb-1">
              Cut corner
            </label>
            <select id="custom-cut" className="input" value={cutCorner} onChange={e => setCutCorner(e.target.value as LShapeCorner)}>
              <option value="tr">Top-right</option>
              <option value="tl">Top-left</option>
              <option value="br">Bottom-right</option>
              <option value="bl">Bottom-left</option>
            </select>
          </div>
          <TextField label="Arm thickness" value={arm} onChange={setArm} placeholder={lengthPlaceholder(units)} />
        </div>
      )}

      {error && <p className="text-xs text-amber">{error}</p>}
      <SaveToLibraryCheckbox checked={saveToLib} onChange={setSaveToLib} />
      <div className="flex justify-end">
        <button type="submit" className="btn-primary">
          Add &amp; place
        </button>
      </div>
    </form>
  );
}

/* ── Presets ─────────────────────────────────────────────────────────── */

/** Built-in presets are standard sizes, so they place as verified catalog items. */
const asPreset = (p: FurniturePreset): PlacingTemplate => ({ ...p, source: 'catalog', confidence: 'verified' });

function PresetsTab({
  units,
  onPlace,
  onSaveToLibrary,
}: {
  units: UnitSystem;
  onPlace: (t: PlacingTemplate) => void;
  onSaveToLibrary: (item: Omit<SavedFurniture, 'id'>) => void;
}) {
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FURNITURE_PRESETS.filter(
      p => (category === 'All' || p.category === category) && (!q || p.name.toLowerCase().includes(q))
    );
  }, [category, query]);

  return (
    <div className="space-y-3">
      <input className="input" aria-label="Search presets" placeholder="Search presets…" value={query} onChange={e => setQuery(e.target.value)} />
      <div className="flex flex-wrap gap-1" role="group" aria-label="Category">
        {['All', ...PRESET_CATEGORIES].map(c => (
          <button
            key={c}
            aria-pressed={category === c}
            className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
              category === c ? 'bg-em text-white border-em' : 'border-line text-ink-mid hover:bg-bg-overlay'
            }`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <ul className="space-y-1 max-h-[42vh] overflow-y-auto">
        {filtered.map(preset => (
          <ItemRow
            key={`${preset.category}-${preset.name}`}
            name={preset.name}
            detail={`${formatLength(preset.widthMm, units)} × ${formatLength(preset.depthMm, units)}`}
            onPlace={() => onPlace(asPreset(preset))}
            secondary={{
              label: '+ lib',
              title: `Save ${preset.name} to library`,
              onClick: () => onSaveToLibrary({ ...preset, source: 'catalog', confidence: 'verified' }),
            }}
          />
        ))}
        {filtered.length === 0 && <li className="text-sm text-ink-muted italic py-2">No presets match.</li>}
      </ul>
    </div>
  );
}

/** A list row with a main "place" action and an optional hover action. */
function ItemRow({
  name,
  detail,
  swatch,
  onPlace,
  secondary,
}: {
  name: string;
  detail: string;
  swatch?: string;
  onPlace: () => void;
  secondary?: { label: string; title: string; onClick: () => void; danger?: boolean };
}) {
  return (
    <li className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-bg-overlay group">
      {swatch && <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: swatch }} />}
      <button className="flex-1 text-left" onClick={onPlace}>
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-ink-muted">{detail}</div>
      </button>
      {secondary && (
        <button
          className={`btn-ghost text-xs reveal-on-hover ${secondary.danger ? '!text-amber' : ''}`}
          title={secondary.title}
          aria-label={secondary.title}
          onClick={secondary.onClick}
        >
          {secondary.label}
        </button>
      )}
      <button className="btn-primary !px-2 !py-1 text-xs" onClick={onPlace} aria-label={`Place ${name}`}>
        Place
      </button>
    </li>
  );
}

/* ── Lookup ──────────────────────────────────────────────────────────── */

function LookupTab({
  onResult,
  onManual,
}: {
  onResult: (dims: FurnitureDimensions) => void;
  onManual: (query: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [noMatch, setNoMatch] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setNoMatch(false);
    try {
      const result = await defaultRegistry.lookup(q);
      if (result) onResult(result);
      else setNoMatch(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-mid">Type a product name to look up its dimensions. A match opens a confirm step before placing.</p>
      <form onSubmit={search} className="flex gap-2">
        <input
          className="input"
          aria-label="Product name"
          placeholder="e.g. IKEA Billy bookcase"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setNoMatch(false);
          }}
        />
        <button type="submit" className="btn-primary whitespace-nowrap" disabled={loading || !query.trim()}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {noMatch && (
        <div className="rounded-md border border-line bg-bg-overlay/50 p-3 text-sm" role="status">
          <p className="text-ink-mid mb-2">
            No match for “{query.trim()}” in the built-in catalog. You can enter the dimensions yourself.
          </p>
          <button className="btn" onClick={() => onManual(query.trim())}>
            Enter manually
          </button>
        </div>
      )}

      <p className="text-xs text-ink-muted">
        Built-in catalog of common IKEA, B&amp;Q and Tesco pieces — e.g. Billy, Kallax, Malm, Pax, Ektorp, Poäng,
        Form Darwin, GoodHome, Fox &amp; Ivy wardrobe, Tesco sofa. Dimensions are approximate — confirm before placing.
      </p>
    </div>
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
        <ItemRow
          key={item.id}
          name={item.name}
          detail={`${formatLength(item.widthMm, units)} × ${formatLength(item.depthMm, units)}`}
          swatch={item.color ?? '#8b7355'}
          onPlace={() => onPlace(item)}
          secondary={{ label: '✕', title: `Remove ${item.name} from library`, onClick: () => onRemove(item.id), danger: true }}
        />
      ))}
    </ul>
  );
}
