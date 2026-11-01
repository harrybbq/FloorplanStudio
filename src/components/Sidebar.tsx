import { useState } from 'react';
import { usePlanStore } from '../state/planStore';
import { useOverlaps } from '../state/useOverlaps';
import { formatLength } from '../lib/units';
import { confidenceMeta, sourceLabel } from '../lib/furniture/provenance';
import { ROOM_ROLES, roomSummary } from '../lib/rooms';
import { ProductThumb } from './ProductThumb';
import { measurementLink, planMeasurement } from '../lib/handoff';
import type { FurnitureItem, PlanLink, Room, Wall } from '../types';

const NO_WALLS: Wall[] = [];
const NO_ROOMS: Room[] = [];

/** Duplicates land this far (mm, diagonally) from the original. */
export const DUPLICATE_OFFSET_MM = 200;

export function Sidebar() {
  const plan = usePlanStore(s => s.active());
  const overlapping = useOverlaps();

  return (
    <aside className="panel rounded-none border-r-0 border-t-0 border-b-0 w-[280px] flex flex-col overflow-hidden">
      <PlansSection />

      <section className="p-3 border-b border-line">
        <h3 className="label mb-2">Scale</h3>
        <ScaleStatus />
      </section>

      <WallsSection />
      <RoomsSection />

      {overlapping.size > 0 && (
        <div className="px-3 py-2 bg-danger/10 border-b border-danger/20 text-xs text-danger-dark font-medium" role="status">
          ⚠ {overlapping.size} {overlapping.size === 1 ? 'item overlaps' : 'items overlap'} another item or a wall.
        </div>
      )}

      <section className="flex-1 overflow-hidden flex flex-col">
        <h3 className="label p-3 pb-1">Furniture {plan && `(${plan.furniture.length})`}</h3>
        <ul className="px-3 pb-3 overflow-y-auto flex-1 space-y-1">
          {plan?.furniture.length === 0 && <li className="text-xs text-ink-muted italic">Nothing placed yet.</li>}
          {plan?.furniture.map(item => <FurnitureRow key={item.id} item={item} overlaps={overlapping.has(item.id)} />)}
        </ul>
      </section>

      <SelectedPanel />
      <ShortcutHelp />
    </aside>
  );
}

function PlansSection() {
  const plans = usePlanStore(s => s.plans);
  const activeId = usePlanStore(s => s.activePlanId);
  const createPlan = usePlanStore(s => s.createPlan);
  const selectPlan = usePlanStore(s => s.selectPlan);
  const deletePlan = usePlanStore(s => s.deletePlan);
  const renamePlan = usePlanStore(s => s.renamePlan);
  const activeLink = usePlanStore(s => s.active()?.link);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');

  function commitRename(id: string) {
    if (draftName.trim()) renamePlan(id, draftName.trim());
    setRenaming(false);
  }

  return (
    <section className="p-3 border-b border-line">
      <div className="flex items-center justify-between mb-2">
        <h3 className="label">Plans</h3>
        <button className="btn-ghost text-xs" onClick={() => createPlan()}>
          + New
        </button>
      </div>
      <ul className="space-y-1 max-h-[140px] overflow-y-auto">
        {plans.map(p => {
          const active = p.id === activeId;
          return (
            <li
              key={p.id}
              className={`flex items-center justify-between gap-1 px-2 py-1.5 rounded-md text-sm group ${
                active ? 'bg-em/10 text-ink font-medium' : 'hover:bg-bg-overlay'
              }`}
            >
              {renaming && active ? (
                <input
                  autoFocus
                  aria-label="Plan name"
                  className="input !py-0.5 !text-sm"
                  value={draftName}
                  onChange={e => setDraftName(e.target.value)}
                  onBlur={() => commitRename(p.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(p.id);
                    if (e.key === 'Escape') setRenaming(false);
                  }}
                />
              ) : (
                <button className="truncate flex-1 text-left" onClick={() => selectPlan(p.id)} aria-current={active || undefined}>
                  {p.name}
                </button>
              )}
              {active && !renaming && (
                <span className="flex gap-1">
                  <button
                    className="text-ink-muted hover:text-ink text-xs px-0.5"
                    aria-label={`Rename ${p.name}`}
                    title="Rename"
                    onClick={() => {
                      setDraftName(p.name);
                      setRenaming(true);
                    }}
                  >
                    ✎
                  </button>
                  {plans.length > 1 && (
                    <button
                      className="text-ink-muted hover:text-amber text-xs px-0.5"
                      aria-label={`Delete ${p.name}`}
                      title="Delete plan"
                      onClick={() => confirm(`Delete "${p.name}"? This can't be undone.`) && deletePlan(p.id)}
                    >
                      ✕
                    </button>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {activeLink && <LinkedListing link={activeLink} />}
    </section>
  );
}

/** Where a plan opened from HouseHunter came from, with links back. */
function LinkedListing({ link }: { link: PlanLink }) {
  const linkClass = 'text-em hover:underline';
  return (
    <p className="mt-2 text-xs text-ink-muted flex flex-wrap gap-x-2">
      <span>From HouseHunter</span>
      {link.returnUrl && (
        // Named target: HouseHunter names its tab, so this goes back to it.
        <a className={linkClass} href={link.returnUrl} target="househunter">
          Back to listing
        </a>
      )}
      {link.listingUrl && (
        <a className={linkClass} href={link.listingUrl} target="_blank" rel="noreferrer noopener">
          Property page ↗
        </a>
      )}
    </p>
  );
}

function ScaleStatus() {
  const calibration = usePlanStore(s => s.active()?.calibration);
  const units = usePlanStore(s => s.units);
  if (!calibration) {
    return (
      <p className="text-xs text-ink-muted">
        Not calibrated. Click <span className="font-medium">Calibrate</span> in the toolbar, then click two points on a known distance.
      </p>
    );
  }
  return (
    <div className="text-xs text-ink-mid space-y-0.5">
      <div>
        <span className="font-mono text-ink">{calibration.pxPerMm.toFixed(3)}</span> px/mm
      </div>
      <div className="text-ink-muted">Reference: {formatLength(calibration.distanceMm, units)}</div>
    </div>
  );
}

function WallsSection() {
  const walls = usePlanStore(s => s.active()?.walls ?? NO_WALLS);
  const hasImage = usePlanStore(s => !!s.active()?.imageDataUrl);
  const startWall = usePlanStore(s => s.startWall);
  const deleteWall = usePlanStore(s => s.deleteWall);
  const clearWalls = usePlanStore(s => s.clearWalls);

  return (
    <section className="p-3 border-b border-line">
      <div className="flex items-center justify-between mb-2">
        <h3 className="label">Walls {walls.length > 0 && `(${walls.length})`}</h3>
        <div className="flex gap-1">
          <button className="btn-ghost text-xs" onClick={startWall} disabled={!hasImage}>
            + Trace
          </button>
          {walls.length > 0 && (
            <button className="btn-ghost text-xs !text-amber" onClick={() => confirm('Clear all walls?') && clearWalls()}>
              Clear
            </button>
          )}
        </div>
      </div>
      {walls.length === 0 ? (
        <p className="text-xs text-ink-muted">Trace walls to catch furniture poking through them.</p>
      ) : (
        <ul className="space-y-1 max-h-[90px] overflow-y-auto">
          {walls.map((wall, i) => (
            <li key={wall.id} className="flex items-center justify-between px-2 py-1 rounded-md text-sm hover:bg-bg-overlay group">
              <span className="text-ink-mid">
                Wall {i + 1}
                <span className="text-ink-muted text-xs ml-1">({wall.points.length} pts)</span>
              </span>
              <button
                className="text-ink-muted hover:text-amber text-xs reveal-on-hover"
                aria-label={`Delete wall ${i + 1}`}
                title="Delete wall"
                onClick={() => deleteWall(wall.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FurnitureRow({ item, overlaps }: { item: FurnitureItem; overlaps: boolean }) {
  const units = usePlanStore(s => s.units);
  const selected = usePlanStore(s => s.selectedFurnitureId === item.id);
  const selectFurniture = usePlanStore(s => s.selectFurniture);
  const meta = confidenceMeta(item.confidence);
  const shapeTag = item.shape?.kind === 'lshape' ? ' · L' : item.shape?.kind === 'polygon' ? ' · custom' : '';

  return (
    <li>
      <button
        onClick={() => selectFurniture(item.id)}
        aria-pressed={selected}
        className={`w-full text-left px-2 py-1.5 rounded-md text-sm border ${
          selected ? 'bg-em/10 border-em/30' : overlaps ? 'border-danger/30 hover:bg-bg-overlay' : 'border-transparent hover:bg-bg-overlay'
        }`}
      >
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: item.color }} />
          <span className="font-medium truncate flex-1">{item.name}</span>
          {overlaps && (
            <span className="text-danger text-xs flex-shrink-0" title="Overlapping">
              ⚠
            </span>
          )}
        </span>
        <span className="text-xs text-ink-muted ml-5 flex items-center gap-1 flex-wrap">
          <span>
            {formatLength(item.widthMm, units)} × {formatLength(item.depthMm, units)}
            {shapeTag}
            {item.rotation > 0 && ` · ${item.rotation}°`}
          </span>
          {item.confidence !== 'user-entered' && (
            <span className="inline-flex items-center gap-1" title={`${sourceLabel(item.source)} · ${meta.label}`}>
              · <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.dot }} />
              {meta.label}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

function SelectedPanel() {
  const selected = usePlanStore(s => s.active()?.furniture.find(f => f.id === s.selectedFurnitureId));
  const pxPerMm = usePlanStore(s => s.active()?.calibration?.pxPerMm ?? 0);
  const rotateFurniture = usePlanStore(s => s.rotateFurniture);
  const flipFurniture = usePlanStore(s => s.flipFurniture);
  const duplicateFurniture = usePlanStore(s => s.duplicateFurniture);
  const deleteFurniture = usePlanStore(s => s.deleteFurniture);
  if (!selected) return null;
  const meta = confidenceMeta(selected.confidence);

  return (
    <section className="p-3 border-t border-line bg-bg-overlay/40">
      <div className="flex items-start gap-2 mb-2">
        {selected.imageUrl && <ProductThumb src={selected.imageUrl} size={44} />}
        <div className="min-w-0">
          <h3 className="label mb-1 truncate" title={selected.name}>
            Selected: {selected.name}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-ink-mid">
            <span className="w-2 h-2 rounded-full" style={{ background: meta.dot }} />
            {meta.label} · {sourceLabel(selected.source)}
            {selected.productUrl && (
              <a className="text-em hover:underline ml-auto" href={selected.productUrl} target="_blank" rel="noreferrer noopener">
                Product ↗
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <button className="btn !px-1" onClick={() => rotateFurniture(selected.id, -15)} title="Rotate left (Shift+R)" aria-label="Rotate 15° left">
          ↺
        </button>
        <button className="btn !px-1" onClick={() => rotateFurniture(selected.id, 15)} title="Rotate right (R)" aria-label="Rotate 15° right">
          ↻
        </button>
        <button className="btn !px-1" onClick={() => flipFurniture(selected.id)} title="Flip (F)" aria-label="Flip horizontally">
          ⇋
        </button>
        <button
          className="btn !px-1"
          onClick={() => duplicateFurniture(selected.id, DUPLICATE_OFFSET_MM * pxPerMm)}
          title="Duplicate (D)"
          aria-label="Duplicate"
        >
          ⧉
        </button>
      </div>
      <button className="btn w-full mt-1.5 !text-amber hover:!bg-amber/10 !border-amber/30" onClick={() => deleteFurniture(selected.id)}>
        Delete
      </button>
    </section>
  );
}

const SHORTCUTS: [string, string][] = [
  ['V', 'Select'],
  ['C', 'Calibrate'],
  ['W', 'Trace walls (Enter / double-click to finish)'],
  ['M', 'Measure a room (click the first corner to close)'],
  ['A', 'Add furniture'],
  ['R / Shift+R', 'Rotate 15°'],
  ['F', 'Flip'],
  ['D', 'Duplicate'],
  ['Arrows', 'Nudge 10 mm (Shift: 100 mm)'],
  ['⌫ / Del', 'Delete (undoable)'],
  ['Esc', 'Cancel tool / deselect'],
  ['Wheel · Middle-drag', 'Zoom · Pan'],
  ['Ctrl/⌘+V', 'Paste a floorplan image'],
];

function RoomsSection() {
  const rooms = usePlanStore(s => s.active()?.rooms ?? NO_ROOMS);
  const hasImage = usePlanStore(s => !!s.active()?.imageDataUrl);
  const pxPerMm = usePlanStore(s => s.active()?.calibration?.pxPerMm ?? null);
  const link = usePlanStore(s => s.active()?.link);
  const units = usePlanStore(s => s.units);
  const startRoom = usePlanStore(s => s.startRoom);
  const deleteRoom = usePlanStore(s => s.deleteRoom);
  const setRoomRole = usePlanStore(s => s.setRoomRole);

  const sendUrl = link && pxPerMm ? measurementLink(link, planMeasurement(rooms, pxPerMm)) : null;

  return (
    <section className="p-3 border-b border-line">
      <div className="flex items-center justify-between mb-2">
        <h3 className="label">Rooms {rooms.length > 0 && `(${rooms.length})`}</h3>
        <button className="btn-ghost text-xs" onClick={startRoom} disabled={!hasImage}>
          + Measure
        </button>
      </div>
      {rooms.length === 0 ? (
        <p className="text-xs text-ink-muted">Trace a room's corners to get its size and area.</p>
      ) : (
        <ul className="space-y-1 max-h-[132px] overflow-y-auto">
          {rooms.map((room, i) => (
            <li key={room.id} className="px-2 py-1 rounded-md hover:bg-bg-overlay group">
              <div className="flex items-center justify-between gap-2">
                <select
                  aria-label={`What room ${i + 1} is`}
                  className="text-sm bg-transparent text-ink-mid rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-em"
                  value={room.role}
                  onChange={e => setRoomRole(room.id, e.target.value as Room['role'])}
                >
                  {ROOM_ROLES.map(r => (
                    <option key={r.value} value={r.value}>
                      {r.value === 'other' ? `Room ${i + 1}` : r.label}
                    </option>
                  ))}
                </select>
                <button
                  className="text-ink-muted hover:text-amber text-xs reveal-on-hover"
                  aria-label={`Delete room ${i + 1}`}
                  title="Delete room"
                  onClick={() => deleteRoom(room.id)}
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-ink-muted">{pxPerMm ? roomSummary(room.points, pxPerMm, units) : 'Calibrate to measure'}</p>
            </li>
          ))}
        </ul>
      )}
      {link &&
        (sendUrl ? (
          <>
            {/* Named target: HouseHunter names its tab, so this lands there. */}
            <a className="btn-primary text-xs w-full justify-center mt-2" href={sendUrl} target="househunter">
              Send to HouseHunter
            </a>
            <p className="text-[11px] text-ink-muted mt-1">You'll confirm in HouseHunter before anything is saved.</p>
          </>
        ) : (
          <p className="text-xs text-ink-muted mt-2">
            {pxPerMm ? 'Mark' : 'Calibrate, then mark'} the whole flat, the kitchen or bedroom 2 to send their sizes to HouseHunter.
          </p>
        ))}
    </section>
  );
}

function ShortcutHelp() {
  return (
    <details className="border-t border-line text-xs">
      <summary className="px-3 py-2 cursor-pointer text-ink-muted hover:text-ink-mid select-none">Keyboard shortcuts</summary>
      <dl className="px-3 pb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {SHORTCUTS.map(([key, what]) => (
          <div key={key} className="contents">
            <dt>
              <kbd className="font-mono text-[11px] px-1 rounded bg-bg-overlay border border-line">{key}</kbd>
            </dt>
            <dd className="text-ink-mid">{what}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
