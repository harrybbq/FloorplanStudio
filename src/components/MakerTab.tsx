import { useMemo, useState } from 'react';
import { Stage, Layer, Line, Circle, Text as KonvaText } from 'react-konva';
import type Konva from 'konva';
import type { FurnitureShape, PlacingTemplate, Point, UnitSystem } from '../types';
import { formatLength, lengthPlaceholder, parseLength } from '../lib/units';

/**
 * Furniture Maker — draw a footprint corner-by-corner on a grid, then scale it
 * to a real width × depth.
 *
 *  - Click to drop corners. Lines snap to the grid and to horizontal/vertical
 *    (ortho) so edges come out straight.
 *  - Click the first corner (or "Close shape") to finish the outline.
 *  - Enter the real width and depth; the drawn shape is scaled so its bounding
 *    box matches exactly. Edge lengths update live in your units.
 *
 * Output is a { kind:'polygon', points } shape (centred mm) — the same shape
 * system used by rectangles and L-shapes, so collision/rotation just work.
 */

const STAGE_W = 408;
const STAGE_H = 288;
const GRID = 24;
const CLOSE_DIST = 13;
const DEFAULT_MM_PER_CELL = 100; // 1 grid cell = 100 mm until the user sets W×D

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type Bbox = { minX: number; minY: number; w: number; h: number };
function bboxOf(points: Point[]): Bbox {
  if (points.length === 0) return { minX: 0, minY: 0, w: 0, h: 0 };
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return { minX, minY, w: maxX - minX, h: maxY - minY };
}

function makeInputValue(mm: number, units: UnitSystem): string {
  return units === 'metric' ? String(Math.round(mm)) : (mm / 25.4).toFixed(1);
}

export function MakerTab({
  units,
  onPlace,
  onSaveToLibrary,
}: {
  units: UnitSystem;
  onPlace: (t: PlacingTemplate) => void;
  onSaveToLibrary: (item: { name: string; widthMm: number; depthMm: number; heightMm: number; shape?: FurnitureShape }) => void;
}) {
  const [points, setPoints] = useState<Point[]>([]);
  const [closed, setClosed] = useState(false);
  const [hover, setHover] = useState<Point | null>(null);
  const [name, setName] = useState('');
  const [width, setWidth] = useState('');
  const [depth, setDepth] = useState('');
  const [height, setHeight] = useState('');
  const [saveToLib, setSaveToLib] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Snap a raw stage point to the grid + ortho-align to the previous corner.
  function snap(raw: Point): Point {
    let x = clamp(Math.round(raw.x / GRID) * GRID, 0, STAGE_W);
    let y = clamp(Math.round(raw.y / GRID) * GRID, 0, STAGE_H);
    const last = points[points.length - 1];
    if (last && !closed) {
      const adx = Math.abs(x - last.x);
      const ady = Math.abs(y - last.y);
      const ang = (Math.atan2(ady, adx) * 180) / Math.PI; // 0 = horizontal, 90 = vertical
      if (adx > 0 || ady > 0) {
        if (ang < 12) y = last.y; // snap horizontal
        else if (ang > 78) x = last.x; // snap vertical
      }
    }
    return { x, y };
  }

  function stagePoint(e: Konva.KonvaEventObject<MouseEvent>): Point | null {
    const pos = e.target.getStage()?.getPointerPosition();
    return pos ? { x: pos.x, y: pos.y } : null;
  }

  function handleMove(e: Konva.KonvaEventObject<MouseEvent>) {
    if (closed) return;
    const raw = stagePoint(e);
    if (raw) setHover(snap(raw));
  }

  function handleClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (closed) return;
    const raw = stagePoint(e);
    if (!raw) return;
    const p = snap(raw);
    // Close if clicking near the first corner with enough points.
    if (points.length >= 3) {
      const first = points[0];
      if (Math.hypot(p.x - first.x, p.y - first.y) <= CLOSE_DIST) {
        finishOutline();
        return;
      }
    }
    // Ignore a zero-length repeat of the last point.
    const last = points[points.length - 1];
    if (last && last.x === p.x && last.y === p.y) return;
    setPoints([...points, p]);
    setError(null);
  }

  function finishOutline() {
    if (points.length < 3) {
      setError('Add at least 3 corners before closing.');
      return;
    }
    setClosed(true);
    setHover(null);
    // Prefill W×D from the grid (1 cell = 100 mm) so it's usable immediately.
    const bb = bboxOf(points);
    if (!width) setWidth(makeInputValue((bb.w / GRID) * DEFAULT_MM_PER_CELL, units));
    if (!depth) setDepth(makeInputValue((bb.h / GRID) * DEFAULT_MM_PER_CELL, units));
  }

  function undoPoint() {
    if (closed) {
      setClosed(false);
      return;
    }
    setPoints(points.slice(0, -1));
  }

  function clearAll() {
    setPoints([]);
    setClosed(false);
    setHover(null);
    setError(null);
  }

  // Scale used for live edge-length labels and the final build.
  const scale = useMemo(() => {
    const bb = bboxOf(points);
    const Wmm = parseLength(width, units);
    const Dmm = parseLength(depth, units);
    if (Wmm && Wmm > 0 && Dmm && Dmm > 0 && bb.w > 0 && bb.h > 0) {
      return { sx: Wmm / bb.w, sy: Dmm / bb.h };
    }
    const d = DEFAULT_MM_PER_CELL / GRID;
    return { sx: d, sy: d };
  }, [points, width, depth, units]);

  function submit() {
    if (!closed || points.length < 3) return setError('Draw and close a shape first.');
    if (!name.trim()) return setError('Give it a name.');
    const Wmm = parseLength(width, units);
    const Dmm = parseLength(depth, units);
    const Hmm = height ? parseLength(height, units) : 0;
    if (Wmm === null || Wmm <= 0) return setError('Width is required.');
    if (Dmm === null || Dmm <= 0) return setError('Depth is required.');
    if (Hmm === null) return setError("Couldn't read the height.");
    const bb = bboxOf(points);
    if (bb.w <= 0 || bb.h <= 0) return setError('Shape has no area — draw a closed outline.');

    const sx = Wmm / bb.w;
    const sy = Dmm / bb.h;
    const cx = bb.minX + bb.w / 2;
    const cy = bb.minY + bb.h / 2;
    const mmPoints = points.map(p => ({ x: (p.x - cx) * sx, y: (p.y - cy) * sy }));
    const shape: FurnitureShape = { kind: 'polygon', points: mmPoints };
    const data = { name: name.trim(), widthMm: Wmm, depthMm: Dmm, heightMm: Hmm, shape };
    if (saveToLib) onSaveToLibrary(data);
    onPlace(data);
  }

  // Grid lines.
  const gridLines: number[][] = [];
  for (let x = 0; x <= STAGE_W; x += GRID) gridLines.push([x, 0, x, STAGE_H]);
  for (let y = 0; y <= STAGE_H; y += GRID) gridLines.push([0, y, STAGE_W, y]);

  const flat = points.flatMap(p => [p.x, p.y]);
  const previewFlat =
    !closed && hover && points.length > 0
      ? [points[points.length - 1].x, points[points.length - 1].y, hover.x, hover.y]
      : null;

  // Edge midpoints + lengths for labels.
  const edges = points.map((p, i) => {
    const q = points[(i + 1) % points.length];
    const isClosing = i === points.length - 1;
    if (isClosing && !closed) return null;
    const len = Math.hypot((q.x - p.x) * scale.sx, (q.y - p.y) * scale.sy);
    return { mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2, len };
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-mid">
        Click to drop corners — lines snap to the grid and to straight. Click the first corner to close,
        then set the real size.
      </p>

      <div className="rounded-md border border-line overflow-hidden bg-cream" style={{ width: STAGE_W, maxWidth: '100%' }}>
        <Stage
          width={STAGE_W}
          height={STAGE_H}
          onMouseMove={handleMove}
          onClick={handleClick}
          style={{ cursor: closed ? 'default' : 'crosshair' }}
        >
          <Layer listening={false}>
            {gridLines.map((l, i) => (
              <Line key={i} points={l} stroke="#e2dccf" strokeWidth={1} />
            ))}
          </Layer>
          <Layer listening={false}>
            {(flat.length >= 4 || closed) && (
              <Line points={flat} closed={closed} stroke="#1a7a4a" strokeWidth={2} fill={closed ? 'rgba(26,122,74,0.18)' : undefined} />
            )}
            {previewFlat && <Line points={previewFlat} stroke="#d4700a" strokeWidth={2} dash={[8, 5]} />}
            {points.map((p, i) => (
              <Circle
                key={i}
                x={p.x}
                y={p.y}
                radius={i === 0 ? 6 : 4}
                fill={i === 0 ? '#d4700a' : '#1a7a4a'}
                stroke="#fdfaf3"
                strokeWidth={1.5}
              />
            ))}
            {hover && !closed && <Circle x={hover.x} y={hover.y} radius={4} fill="#1a7a4a" opacity={0.4} />}
            {edges.map((e, i) =>
              e ? (
                <KonvaText
                  key={`e${i}`}
                  x={e.mx - 22}
                  y={e.my - 14}
                  width={44}
                  align="center"
                  text={formatLength(e.len, units)}
                  fontSize={10}
                  fill="#4a4540"
                />
              ) : null
            )}
          </Layer>
        </Stage>
      </div>

      <div className="flex gap-1.5">
        <button className="btn flex-1" onClick={finishOutline} disabled={closed || points.length < 3}>
          Close shape
        </button>
        <button className="btn flex-1" onClick={undoPoint} disabled={points.length === 0 && !closed}>
          {closed ? 'Reopen' : 'Undo point'}
        </button>
        <button className="btn flex-1" onClick={clearAll} disabled={points.length === 0}>
          Clear
        </button>
      </div>

      {closed && (
        <>
          <div>
            <label className="label block mb-1">Name</label>
            <input className="input" placeholder="e.g. Reception desk" value={name} onChange={e => setName(e.target.value)} />
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
          <label className="flex items-center gap-2 text-sm text-ink-mid cursor-pointer select-none">
            <input type="checkbox" checked={saveToLib} onChange={e => setSaveToLib(e.target.checked)} />
            Save to library for reuse
          </label>
        </>
      )}

      {error && <p className="text-xs text-amber">{error}</p>}

      <div className="flex justify-end">
        <button className="btn-primary" onClick={submit} disabled={!closed}>
          Add &amp; place
        </button>
      </div>
    </div>
  );
}
