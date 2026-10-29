import { useMemo, useState } from 'react';
import { Stage, Layer, Line, Circle, Text as KonvaText } from 'react-konva';
import type Konva from 'konva';
import type { FurnitureShape, PlacingTemplate, Point, UnitSystem } from '../types';
import { formatLength, parseLength, toInputValue } from '../lib/units';
import { straighten } from '../lib/rooms';
import {
  DimensionFields,
  EMPTY_DIMENSIONS,
  parseDimensions,
  SaveToLibraryCheckbox,
  TextField,
  type DimensionInputs,
  type ManualItem,
} from './FormFields';

/**
 * Furniture Maker — draw a footprint corner-by-corner on a grid, then scale it
 * to a real width × depth.
 *
 *  - Click (or tap) to drop corners. Points snap to the grid, and each edge
 *    snaps to horizontal/vertical when it's within 12° of it, so edges come out straight.
 *  - Click the first corner (or "Close shape") to finish the outline.
 *  - Enter the real width and depth; the drawn bounding box scales to fit
 *    exactly. Edge lengths update live in the user's units.
 *
 * Output is a { kind:'polygon', points } shape (centred mm), so rotation,
 * flipping and overlap detection all work like any other piece.
 */

const STAGE_W = 408;
const STAGE_H = 288;
const GRID = 24;
const CLOSE_DIST = 13;
const ORTHO_SNAP_DEG = 12;
const DEFAULT_MM_PER_CELL = 100; // until the user sets W×D

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type Bbox = { minX: number; minY: number; w: number; h: number };
function bboxOf(points: Point[]): Bbox {
  if (points.length === 0) return { minX: 0, minY: 0, w: 0, h: 0 };
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { minX, minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
}

const gridSnap = (raw: Point): Point => ({
  x: clamp(Math.round(raw.x / GRID) * GRID, 0, STAGE_W),
  y: clamp(Math.round(raw.y / GRID) * GRID, 0, STAGE_H),
});

export function MakerTab({
  units,
  onPlace,
  onSaveToLibrary,
}: {
  units: UnitSystem;
  onPlace: (t: PlacingTemplate) => void;
  onSaveToLibrary: (item: ManualItem) => void;
}) {
  const [points, setPoints] = useState<Point[]>([]);
  const [closed, setClosed] = useState(false);
  const [hover, setHover] = useState<Point | null>(null);
  const [name, setName] = useState('');
  const [dims, setDims] = useState<DimensionInputs>(EMPTY_DIMENSIONS);
  const [saveToLib, setSaveToLib] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const first = points[0];
  /** Would a click at this (grid-snapped) point close the outline? */
  const closesAt = (p: Point) => points.length >= 3 && Math.hypot(p.x - first.x, p.y - first.y) <= CLOSE_DIST;

  /** Grid snap, then straighten the edge from the previous corner. */
  function snap(raw: Point): Point {
    return straighten(points[points.length - 1], gridSnap(raw), ORTHO_SNAP_DEG);
  }

  const pointer = (e: Konva.KonvaEventObject<Event>): Point | null => e.target.getStage()?.getPointerPosition() ?? null;

  function handleMove(e: Konva.KonvaEventObject<Event>) {
    if (closed) return;
    const raw = pointer(e);
    if (!raw) return;
    // Check closing against the grid point *before* straightening, or the snap
    // can pull the cursor off the first corner.
    setHover(closesAt(gridSnap(raw)) ? first : snap(raw));
  }

  function handleClick(e: Konva.KonvaEventObject<Event>) {
    if (closed) return;
    const raw = pointer(e);
    if (!raw) return;
    if (closesAt(gridSnap(raw))) return finishOutline();
    const p = snap(raw);
    const last = points[points.length - 1];
    if (last && last.x === p.x && last.y === p.y) return;
    setPoints([...points, p]);
    setError(null);
  }

  function finishOutline() {
    if (points.length < 3) return setError('Add at least 3 corners before closing.');
    setClosed(true);
    setHover(null);
    // Pre-fill W×D from the grid (1 cell = 100 mm) so it's usable immediately.
    const bb = bboxOf(points);
    setDims(d => ({
      ...d,
      width: d.width || toInputValue((bb.w / GRID) * DEFAULT_MM_PER_CELL, units),
      depth: d.depth || toInputValue((bb.h / GRID) * DEFAULT_MM_PER_CELL, units),
    }));
  }

  function undoPoint() {
    if (closed) setClosed(false);
    else setPoints(points.slice(0, -1));
  }

  function clearAll() {
    setPoints([]);
    setClosed(false);
    setHover(null);
    setError(null);
  }

  // mm per drawn pixel, for the live edge labels and the final build.
  const scale = useMemo(() => {
    const bb = bboxOf(points);
    const w = parseLength(dims.width, units);
    const d = parseLength(dims.depth, units);
    if (w && w > 0 && d && d > 0 && bb.w > 0 && bb.h > 0) return { sx: w / bb.w, sy: d / bb.h };
    const k = DEFAULT_MM_PER_CELL / GRID;
    return { sx: k, sy: k };
  }, [points, dims.width, dims.depth, units]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!closed) return setError('Draw and close a shape first.');
    if (!name.trim()) return setError('Give it a name.');
    const parsed = parseDimensions(dims, units);
    if (!parsed.ok) return setError(parsed.error);
    const bb = bboxOf(points);
    if (bb.w <= 0 || bb.h <= 0) return setError('Shape has no area — draw a closed outline.');

    const { widthMm, depthMm } = parsed.value;
    const cx = bb.minX + bb.w / 2;
    const cy = bb.minY + bb.h / 2;
    const shape: FurnitureShape = {
      kind: 'polygon',
      points: points.map(p => ({ x: ((p.x - cx) * widthMm) / bb.w, y: ((p.y - cy) * depthMm) / bb.h })),
    };
    const item: ManualItem = { name: name.trim(), ...parsed.value, shape };
    if (saveToLib) onSaveToLibrary(item);
    onPlace(item);
  }

  const gridLines: number[][] = [];
  for (let x = 0; x <= STAGE_W; x += GRID) gridLines.push([x, 0, x, STAGE_H]);
  for (let y = 0; y <= STAGE_H; y += GRID) gridLines.push([0, y, STAGE_W, y]);

  const last = points[points.length - 1];
  const edges = points
    .map((p, i) => {
      if (i === points.length - 1 && !closed) return null; // closing edge not drawn yet
      const q = points[(i + 1) % points.length];
      return { mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2, len: Math.hypot((q.x - p.x) * scale.sx, (q.y - p.y) * scale.sy) };
    })
    .filter(e => e !== null);

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-ink-mid">
        Click to drop corners — they snap to the grid and edges snap straight. Click the first corner to close, then set the real size.
      </p>

      <div className="rounded-md border border-line overflow-hidden bg-cream" style={{ width: STAGE_W, maxWidth: '100%' }}>
        <Stage
          width={STAGE_W}
          height={STAGE_H}
          onMouseMove={handleMove}
          onTouchMove={handleMove}
          onMouseLeave={() => setHover(null)}
          onClick={handleClick}
          onTap={handleClick}
          style={{ cursor: closed ? 'default' : 'crosshair', touchAction: 'none' }}
        >
          <Layer listening={false}>
            {gridLines.map((l, i) => (
              <Line key={i} points={l} stroke="#e2dccf" strokeWidth={1} />
            ))}
          </Layer>
          <Layer listening={false}>
            {points.length >= 2 && (
              <Line
                points={points.flatMap(p => [p.x, p.y])}
                closed={closed}
                stroke="#1a7a4a"
                strokeWidth={2}
                fill={closed ? 'rgba(26,122,74,0.18)' : undefined}
              />
            )}
            {!closed && hover && last && <Line points={[last.x, last.y, hover.x, hover.y]} stroke="#d4700a" strokeWidth={2} dash={[8, 5]} />}
            {points.map((p, i) => (
              <Circle
                key={i}
                x={p.x}
                y={p.y}
                radius={i === 0 ? (hover === first ? 8 : 6) : 4}
                fill={i === 0 ? '#d4700a' : '#1a7a4a'}
                stroke="#fdfaf3"
                strokeWidth={1.5}
              />
            ))}
            {hover && !closed && hover !== first && <Circle x={hover.x} y={hover.y} radius={4} fill="#1a7a4a" opacity={0.4} />}
            {edges.map((e, i) => (
              <KonvaText key={i} x={e.mx - 30} y={e.my - 14} width={60} align="center" text={formatLength(e.len, units)} fontSize={10} fill="#4a4540" />
            ))}
          </Layer>
        </Stage>
      </div>

      <div className="flex gap-1.5">
        <button type="button" className="btn flex-1" onClick={finishOutline} disabled={closed || points.length < 3}>
          Close shape
        </button>
        <button type="button" className="btn flex-1" onClick={undoPoint} disabled={points.length === 0}>
          {closed ? 'Reopen' : 'Undo point'}
        </button>
        <button type="button" className="btn flex-1" onClick={clearAll} disabled={points.length === 0}>
          Clear
        </button>
      </div>

      {closed && (
        <>
          <TextField label="Name" value={name} onChange={setName} placeholder="e.g. Reception desk" />
          <DimensionFields units={units} value={dims} onChange={setDims} />
          <SaveToLibraryCheckbox checked={saveToLib} onChange={setSaveToLib} />
        </>
      )}

      {error && <p className="text-xs text-amber">{error}</p>}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={!closed}>
          Add &amp; place
        </button>
      </div>
    </form>
  );
}
