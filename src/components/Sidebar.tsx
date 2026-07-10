import { useState } from 'react';
import { usePlanStore } from '../state/planStore';
import { useOverlaps } from '../state/useOverlaps';
import { formatLength } from '../lib/units';
import { confidenceMeta, sourceLabel } from '../lib/furniture/provenance';

export function Sidebar() {
  const plans = usePlanStore(s => s.plans);
  const activeId = usePlanStore(s => s.activePlanId);
  const plan = usePlanStore(s => s.active());
  const units = usePlanStore(s => s.units);
  const selectedId = usePlanStore(s => s.selectedFurnitureId);
  const selectFurniture = usePlanStore(s => s.selectFurniture);
  const deleteFurniture = usePlanStore(s => s.deleteFurniture);
  const rotateFurniture = usePlanStore(s => s.rotateFurniture);
  const flipFurniture = usePlanStore(s => s.flipFurniture);
  const createPlan = usePlanStore(s => s.createPlan);
  const selectPlan = usePlanStore(s => s.selectPlan);
  const deletePlan = usePlanStore(s => s.deletePlan);
  const renamePlan = usePlanStore(s => s.renamePlan);
  const startWall = usePlanStore(s => s.startWall);
  const deleteWall = usePlanStore(s => s.deleteWall);
  const clearWalls = usePlanStore(s => s.clearWalls);

  const overlapping = useOverlaps();

  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');

  const selected = plan?.furniture.find(f => f.id === selectedId);

  return (
    <aside className="panel rounded-none border-r-0 border-t-0 border-b-0 w-[280px] flex flex-col overflow-hidden">
      {/* Plans section */}
      <section className="p-3 border-b border-line">
        <div className="flex items-center justify-between mb-2">
          <h3 className="label">Plans</h3>
          <button
            className="btn-ghost text-xs"
            onClick={() => createPlan(`Plan ${plans.length + 1}`)}
          >
            + New
          </button>
        </div>
        <ul className="space-y-1 max-h-[140px] overflow-y-auto">
          {plans.map(p => (
            <li key={p.id}>
              <div
                className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer text-sm ${
                  p.id === activeId ? 'bg-em/10 text-ink font-medium' : 'hover:bg-bg-overlay'
                }`}
                onClick={() => selectPlan(p.id)}
              >
                {renaming && p.id === activeId ? (
                  <input
                    autoFocus
                    className="input !py-0.5 !text-sm"
                    value={draftName}
                    onChange={e => setDraftName(e.target.value)}
                    onBlur={() => {
                      if (draftName.trim()) renamePlan(p.id, draftName.trim());
                      setRenaming(false);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        if (draftName.trim()) renamePlan(p.id, draftName.trim());
                        setRenaming(false);
                      }
                      if (e.key === 'Escape') setRenaming(false);
                    }}
                  />
                ) : (
                  <span className="truncate">{p.name}</span>
                )}
                {p.id === activeId && !renaming && (
                  <span className="flex gap-1">
                    <button
                      className="text-ink-muted hover:text-ink text-xs"
                      onClick={e => {
                        e.stopPropagation();
                        setDraftName(p.name);
                        setRenaming(true);
                      }}
                    >
                      ✎
                    </button>
                    {plans.length > 1 && (
                      <button
                        className="text-ink-muted hover:text-amber text-xs"
                        onClick={e => {
                          e.stopPropagation();
                          if (confirm(`Delete "${p.name}"?`)) deletePlan(p.id);
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Calibration status */}
      <section className="p-3 border-b border-line">
        <h3 className="label mb-2">Scale</h3>
        {plan?.calibration ? (
          <div className="text-xs text-ink-mid space-y-0.5">
            <div>
              <span className="font-mono text-ink">{plan.calibration.pxPerMm.toFixed(3)}</span> px/mm
            </div>
            <div className="text-ink-muted">
              Reference: {formatLength(plan.calibration.distanceMm, units)}
            </div>
          </div>
        ) : (
          <p className="text-xs text-ink-muted">
            Not calibrated. Click <span className="font-medium">Calibrate</span> in the toolbar, then click two points on a known distance.
          </p>
        )}
      </section>

      {/* Walls section */}
      <section className="p-3 border-b border-line">
        <div className="flex items-center justify-between mb-2">
          <h3 className="label">Walls {plan && plan.walls.length > 0 && `(${plan.walls.length})`}</h3>
          <div className="flex gap-1">
            <button className="btn-ghost text-xs" onClick={startWall} disabled={!plan?.imageDataUrl}>
              + Trace
            </button>
            {plan && plan.walls.length > 0 && (
              <button
                className="btn-ghost text-xs !text-amber"
                onClick={() => {
                  if (confirm('Clear all walls?')) clearWalls();
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
        {plan && plan.walls.length === 0 ? (
          <p className="text-xs text-ink-muted">
            Trace walls to catch furniture poking through them.
          </p>
        ) : (
          <ul className="space-y-1 max-h-[90px] overflow-y-auto">
            {plan?.walls.map((wall, i) => (
              <li
                key={wall.id}
                className="flex items-center justify-between px-2 py-1 rounded-md text-sm hover:bg-bg-overlay group"
              >
                <span className="text-ink-mid">
                  Wall {i + 1}
                  <span className="text-ink-muted text-xs ml-1">
                    ({wall.points.length} pts)
                  </span>
                </span>
                <button
                  className="text-ink-muted hover:text-amber text-xs opacity-0 group-hover:opacity-100"
                  onClick={() => deleteWall(wall.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Overlap warning */}
      {overlapping.size > 0 && (
        <div className="px-3 py-2 bg-[#e02424]/10 border-b border-[#e02424]/20 text-xs text-[#b91c1c] font-medium">
          ⚠ {overlapping.size} {overlapping.size === 1 ? 'item overlaps' : 'items overlap'} another
          item or a wall.
        </div>
      )}

      {/* Furniture list */}
      <section className="flex-1 overflow-hidden flex flex-col">
        <div className="p-3 pb-1">
          <h3 className="label">Furniture {plan && `(${plan.furniture.length})`}</h3>
        </div>
        <ul className="px-3 pb-3 overflow-y-auto flex-1 space-y-1">
          {plan?.furniture.length === 0 && (
            <li className="text-xs text-ink-muted italic">Nothing placed yet.</li>
          )}
          {plan?.furniture.map(item => {
            const overlaps = overlapping.has(item.id);
            return (
              <li
                key={item.id}
                className={`px-2 py-1.5 rounded-md cursor-pointer text-sm border ${
                  selectedId === item.id
                    ? 'bg-em/10 border-em/30'
                    : overlaps
                    ? 'border-[#e02424]/30 hover:bg-bg-overlay'
                    : 'border-transparent hover:bg-bg-overlay'
                }`}
                onClick={() => selectFurniture(item.id)}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ background: item.color }}
                  />
                  <span className="font-medium truncate flex-1">{item.name}</span>
                  {overlaps && (
                    <span className="text-[#e02424] text-xs flex-shrink-0" title="Overlapping">
                      ⚠
                    </span>
                  )}
                </div>
                <div className="text-xs text-ink-muted ml-5 flex items-center gap-1 flex-wrap">
                  <span>
                    {formatLength(item.widthMm, units)} × {formatLength(item.depthMm, units)}
                    {item.shape?.kind === 'lshape' && ' · L'}
                    {item.shape?.kind === 'polygon' && ' · custom'}
                    {item.rotation > 0 && ` · ${item.rotation}°`}
                  </span>
                  {item.confidence !== 'user-entered' && (
                    <span
                      className="inline-flex items-center gap-1"
                      title={`${sourceLabel(item.source)} · ${confidenceMeta(item.confidence).label}`}
                    >
                      ·
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: confidenceMeta(item.confidence).dot }}
                      />
                      {confidenceMeta(item.confidence).label}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Selected item controls */}
      {selected && (
        <section className="p-3 border-t border-line bg-bg-overlay/40">
          <h3 className="label mb-1">Selected: {selected.name}</h3>
          <div className="flex items-center gap-1.5 mb-2 text-xs text-ink-mid">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: confidenceMeta(selected.confidence).dot }}
            />
            {confidenceMeta(selected.confidence).label} · {sourceLabel(selected.source)}
          </div>
          <div className="flex gap-1.5">
            <button className="btn flex-1" onClick={() => rotateFurniture(selected.id, -15)}>
              ↺ 15°
            </button>
            <button className="btn flex-1" onClick={() => rotateFurniture(selected.id, 15)}>
              ↻ 15°
            </button>
            <button className="btn flex-1" onClick={() => flipFurniture(selected.id)} title="Flip horizontally (F)">
              ⇋ Flip
            </button>
          </div>
          <button
            className="btn w-full mt-2 !text-amber hover:!bg-amber/10 !border-amber/30"
            onClick={() => {
              if (confirm(`Delete "${selected.name}"?`)) deleteFurniture(selected.id);
            }}
          >
            Delete
          </button>
        </section>
      )}
    </aside>
  );
}
