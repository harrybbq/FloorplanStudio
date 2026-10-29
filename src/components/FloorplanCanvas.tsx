import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Group, Text, Line, Circle } from 'react-konva';
import type Konva from 'konva';
import { usePlanStore } from '../state/planStore';
import { useOverlaps } from '../state/useOverlaps';
import { formatLength } from '../lib/units';
import { localOutline, badgeAnchor } from '../lib/footprint';
import type { FurnitureItem, PlacingTemplate, Point } from '../types';
import { CalibrationDistanceModal } from './CalibrationDistanceModal';

const OVERLAP_RED = '#e02424';
const WALL_COLOR = '#3a3530';
const MIN_SCALE = 0.05;
const MAX_SCALE = 8;
const FIT_PADDING = 40;
/** A drag shorter than this (screen px) is still a click. */
const PAN_CLICK_SLOP = 3;
/** Points closer than this on screen count as the same point. */
const SAME_POINT_SCREEN_PX = 4;
const DOUBLE_CLICK_MS = 400;

type View = { scale: number; x: number; y: number };

/**
 * The drawing surface. Owns:
 *   - Image loading + fit-to-screen
 *   - Pan (middle-drag, or Alt+drag on empty space) and wheel zoom
 *   - Click handling for calibration, wall tracing and furniture placement
 *   - Furniture selection + drag
 *
 * All real-world coords are stored in IMAGE pixel-space. Stage scale/offset
 * is a pure view transform — calibration's pxPerMm survives zoom unchanged.
 */
export function FloorplanCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);

  const plan = usePlanStore(s => s.active());
  const mode = usePlanStore(s => s.mode);
  const units = usePlanStore(s => s.units);
  const pendingPoint = usePlanStore(s => s.pendingCalibrationPoint);
  const pendingSecond = usePlanStore(s => s.pendingCalibrationSecond);
  const selectedId = usePlanStore(s => s.selectedFurnitureId);
  const placingTemplate = usePlanStore(s => s.placingTemplate);
  const draftWallPoints = usePlanStore(s => s.draftWallPoints);

  const addCalibrationPoint = usePlanStore(s => s.addCalibrationPoint);
  const commitCalibration = usePlanStore(s => s.commitCalibration);
  const cancelPendingCalibration = usePlanStore(s => s.cancelPendingCalibration);
  const placeFurnitureAt = usePlanStore(s => s.placeFurnitureAt);
  const selectFurniture = usePlanStore(s => s.selectFurniture);
  const updateFurniture = usePlanStore(s => s.updateFurniture);
  const addWallPoint = usePlanStore(s => s.addWallPoint);
  const finishWall = usePlanStore(s => s.finishWall);

  const overlapping = useOverlaps();
  const imageEl = useImage(plan?.imageDataUrl ?? null);

  // — container size —
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // — view transform —
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });

  // A hidden or collapsed container (e.g. a background tab) has no room to fit into.
  const canFit = !!size && size.w > FIT_PADDING * 2 && size.h > FIT_PADDING * 2;

  function fitView() {
    if (!imageEl || !size || !canFit) return;
    const scale = Math.max(
      MIN_SCALE,
      Math.min((size.w - FIT_PADDING * 2) / imageEl.naturalWidth, (size.h - FIT_PADDING * 2) / imageEl.naturalHeight, 1)
    );
    setView({
      scale,
      x: (size.w - imageEl.naturalWidth * scale) / 2,
      y: (size.h - imageEl.naturalHeight * scale) / 2,
    });
  }

  // Fit once per image (not on every resize, so the user's zoom/pan survives).
  const fittedFor = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (imageEl && canFit && fittedFor.current !== imageEl) {
      fittedFor.current = imageEl;
      fitView();
    }
  }, [imageEl, size]); // fitView (and canFit) only read these two

  function zoomAt(factor: number, anchor: Point) {
    setView(v => {
      const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.scale * factor));
      const k = scale / v.scale;
      return { scale, x: anchor.x - (anchor.x - v.x) * k, y: anchor.y - (anchor.y - v.y) * k };
    });
  }

  /** Pointer position in image space. */
  function imagePoint(): Point | null {
    return stageRef.current?.getRelativePointerPosition() ?? null;
  }

  const samePointPx = SAME_POINT_SCREEN_PX / view.scale;

  // — pan —
  const pan = useRef({ active: false, lastX: 0, lastY: 0, travelled: 0 });
  const [panning, setPanning] = useState(false);

  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    pan.current.travelled = 0;
    const onEmpty = e.target === e.target.getStage();
    if (e.evt.button === 1 || (e.evt.button === 0 && e.evt.altKey && onEmpty)) {
      e.evt.preventDefault();
      pan.current = { active: true, lastX: e.evt.clientX, lastY: e.evt.clientY, travelled: 0 };
      setPanning(true);
    }
  }

  function endPan() {
    pan.current.active = false;
    setPanning(false);
  }

  // Only the tools that draw a preview need the live cursor position.
  const tracksHover = mode === 'placing' || mode === 'wall' || (mode === 'calibrate' && !!pendingPoint && !pendingSecond);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);

  function handleMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    if (pan.current.active) {
      const dx = e.evt.clientX - pan.current.lastX;
      const dy = e.evt.clientY - pan.current.lastY;
      pan.current.lastX = e.evt.clientX;
      pan.current.lastY = e.evt.clientY;
      pan.current.travelled += Math.abs(dx) + Math.abs(dy);
      setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
      return;
    }
    if (tracksHover) setHoverPoint(imagePoint());
  }

  // Our own double-click detection. Konva's `dblclick` counts any two releases —
  // e.g. a middle-button pan followed by a quick click — which would end a wall early.
  const lastClick = useRef({ at: 0, x: 0, y: 0 });

  // Konva fires `click` for every button on release, including at the end of a pan.
  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (!plan || e.evt.button !== 0 || e.evt.altKey || pan.current.travelled > PAN_CLICK_SLOP) return;
    const pt = imagePoint();
    if (!pt) return;

    const prev = lastClick.current;
    const isDouble =
      e.evt.timeStamp - prev.at < DOUBLE_CLICK_MS && Math.hypot(e.evt.clientX - prev.x, e.evt.clientY - prev.y) <= SAME_POINT_SCREEN_PX;
    lastClick.current = { at: isDouble ? 0 : e.evt.timeStamp, x: e.evt.clientX, y: e.evt.clientY };

    if (mode === 'calibrate') {
      if (!pendingSecond) addCalibrationPoint(pt, samePointPx);
    } else if (mode === 'placing') {
      placeFurnitureAt(pt.x, pt.y);
    } else if (mode === 'wall') {
      if (isDouble) finishWall();
      else addWallPoint(pt, samePointPx);
    } else {
      // Furniture clicks stop propagation, so reaching here means empty space.
      selectFurniture(null);
    }
  }

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const pointer = stageRef.current?.getPointerPosition();
    if (pointer) zoomAt(e.evt.deltaY > 0 ? 1 / 1.1 : 1.1, pointer);
  }

  const pxPerMm = plan?.calibration?.pxPerMm ?? null;

  if (!plan) return null;

  const stageW = size?.w ?? 800;
  const stageH = size?.h ?? 600;
  const center = { x: stageW / 2, y: stageH / 2 };
  const calibrationEnd = pendingSecond ?? hoverPoint;

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      <Stage
        ref={stageRef}
        width={stageW}
        height={stageH}
        scaleX={view.scale}
        scaleY={view.scale}
        x={view.x}
        y={view.y}
        onClick={handleStageClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endPan}
        onMouseLeave={() => {
          endPan();
          setHoverPoint(null);
        }}
        onWheel={handleWheel}
        style={{ cursor: panning ? 'grabbing' : mode === 'select' ? 'default' : 'crosshair' }}
      >
        <Layer>
          {imageEl && (
            <KonvaImage
              image={imageEl}
              width={imageEl.naturalWidth}
              height={imageEl.naturalHeight}
              listening={false}
              opacity={mode === 'placing' ? 0.85 : 1}
            />
          )}

          {/* Committed walls */}
          {plan.walls.map(wall => (
            <Line
              key={wall.id}
              points={wall.points.flatMap(p => [p.x, p.y])}
              stroke={WALL_COLOR}
              strokeWidth={5 / view.scale}
              lineCap="round"
              lineJoin="round"
              listening={false}
            />
          ))}

          {/* In-progress wall */}
          {mode === 'wall' && draftWallPoints.length > 0 && (
            <>
              <Line
                points={[
                  ...draftWallPoints.flatMap(p => [p.x, p.y]),
                  ...(hoverPoint ? [hoverPoint.x, hoverPoint.y] : []),
                ]}
                stroke={WALL_COLOR}
                strokeWidth={5 / view.scale}
                lineCap="round"
                lineJoin="round"
                dash={[10 / view.scale, 6 / view.scale]}
                opacity={0.7}
                listening={false}
              />
              {draftWallPoints.map((p, i) => (
                <Circle key={i} x={p.x} y={p.y} radius={4 / view.scale} fill={WALL_COLOR} listening={false} />
              ))}
            </>
          )}

          {/* Committed calibration line */}
          {plan.calibration && (
            <CalibrationLine
              p1={plan.calibration.points[0]}
              p2={plan.calibration.points[1]}
              label={formatLength(plan.calibration.distanceMm, units)}
              viewScale={view.scale}
            />
          )}

          {/* Calibration in progress */}
          {mode === 'calibrate' && pendingPoint && (
            <Group listening={false}>
              <Circle x={pendingPoint.x} y={pendingPoint.y} radius={6 / view.scale} fill="#d4700a" />
              {calibrationEnd && (
                <Line
                  points={[pendingPoint.x, pendingPoint.y, calibrationEnd.x, calibrationEnd.y]}
                  stroke="#d4700a"
                  strokeWidth={2 / view.scale}
                  dash={[8 / view.scale, 6 / view.scale]}
                />
              )}
              {pendingSecond && <Circle x={pendingSecond.x} y={pendingSecond.y} radius={6 / view.scale} fill="#d4700a" />}
            </Group>
          )}

          {/* Placing preview */}
          {mode === 'placing' && placingTemplate && hoverPoint && pxPerMm && (
            <PlacingGhost at={hoverPoint} template={placingTemplate} pxPerMm={pxPerMm} viewScale={view.scale} />
          )}

          {/* Furniture */}
          {pxPerMm &&
            plan.furniture.map(item => (
              <FurnitureShape
                key={item.id}
                item={item}
                pxPerMm={pxPerMm}
                viewScale={view.scale}
                selected={selectedId === item.id}
                overlapping={overlapping.has(item.id)}
                interactive={mode === 'select'}
                onSelect={() => selectFurniture(item.id)}
                onDragEnd={(x, y) => updateFurniture(item.id, { x, y })}
                unitsLabel={`${formatLength(item.widthMm, units)} × ${formatLength(item.depthMm, units)}`}
              />
            ))}
        </Layer>
      </Stage>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 panel flex items-center text-xs shadow-md" role="group" aria-label="Zoom">
        <button className="btn-ghost !rounded-r-none" onClick={() => zoomAt(1 / 1.25, center)} aria-label="Zoom out">
          −
        </button>
        <span className="px-1.5 font-mono text-ink-mid tabular-nums w-12 text-center">{Math.round(view.scale * 100)}%</span>
        <button className="btn-ghost !rounded-none" onClick={() => zoomAt(1.25, center)} aria-label="Zoom in">
          +
        </button>
        <button className="btn-ghost !rounded-l-none border-l border-line" onClick={fitView}>
          Fit
        </button>
      </div>

      {mode === 'calibrate' && pendingPoint && pendingSecond && (
        <CalibrationDistanceModal units={units} onCancel={cancelPendingCalibration} onCommit={commitCalibration} />
      )}
    </div>
  );
}

/** Decode a data URL into an <img> for Konva, ignoring results for a superseded src. */
function useImage(src: string | null): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) {
      setImg(null);
      return;
    }
    let cancelled = false;
    const el = new window.Image();
    el.onload = () => !cancelled && setImg(el);
    el.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);
  return img;
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function CalibrationLine({ p1, p2, label, viewScale }: { p1: Point; p2: Point; label: string; viewScale: number }) {
  const labelWidth = 200 / viewScale;
  return (
    <Group listening={false}>
      <Line points={[p1.x, p1.y, p2.x, p2.y]} stroke="#1a7a4a" strokeWidth={2 / viewScale} />
      <Circle x={p1.x} y={p1.y} radius={5 / viewScale} fill="#1a7a4a" />
      <Circle x={p2.x} y={p2.y} radius={5 / viewScale} fill="#1a7a4a" />
      <Text
        x={(p1.x + p2.x) / 2 - labelWidth / 2}
        y={(p1.y + p2.y) / 2 - 18 / viewScale}
        width={labelWidth}
        align="center"
        text={label}
        fontSize={13 / viewScale}
        fontStyle="bold"
        fill="#1a7a4a"
      />
    </Group>
  );
}

function PlacingGhost({
  at,
  template,
  pxPerMm,
  viewScale,
}: {
  at: Point;
  template: PlacingTemplate;
  pxPerMm: number;
  viewScale: number;
}) {
  const points = localOutline(template.widthMm, template.depthMm, template.shape).flatMap(p => [p.x * pxPerMm, p.y * pxPerMm]);
  return (
    <Line
      x={at.x}
      y={at.y}
      points={points}
      closed
      fill="#1a7a4a"
      opacity={0.32}
      stroke="#1a7a4a"
      strokeWidth={1.5 / viewScale}
      dash={[6 / viewScale, 4 / viewScale]}
      listening={false}
    />
  );
}

function FurnitureShape({
  item,
  pxPerMm,
  viewScale,
  selected,
  overlapping,
  interactive,
  onSelect,
  onDragEnd,
  unitsLabel,
}: {
  item: FurnitureItem;
  pxPerMm: number;
  viewScale: number;
  selected: boolean;
  overlapping: boolean;
  interactive: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  unitsLabel: string;
}) {
  const w = item.widthMm * pxPerMm;
  const d = item.depthMm * pxPerMm;
  const outline = useMemo(
    () => localOutline(item.widthMm, item.depthMm, item.shape).flatMap(p => [p.x * pxPerMm, p.y * pxPerMm]),
    [item.widthMm, item.depthMm, item.shape, pxPerMm]
  );
  const anchor = badgeAnchor(item.widthMm, item.depthMm, item.shape);

  return (
    <Group
      x={item.x}
      y={item.y}
      rotation={item.rotation}
      draggable={interactive}
      listening={interactive}
      onClick={e => {
        e.cancelBubble = true;
        onSelect();
      }}
      onTap={e => {
        e.cancelBubble = true;
        onSelect();
      }}
      onDragStart={onSelect}
      onDragEnd={e => onDragEnd(e.target.x(), e.target.y())}
    >
      <Line
        points={outline}
        closed
        fill={overlapping ? OVERLAP_RED : item.color}
        opacity={overlapping ? 0.5 : 0.78}
        stroke={overlapping ? OVERLAP_RED : '#1c1a17'}
        strokeWidth={(overlapping ? 3 : selected ? 2.5 : 1) / viewScale}
        dash={overlapping ? [8 / viewScale, 4 / viewScale] : undefined}
        shadowColor="#000"
        shadowBlur={selected ? 8 : 0}
        shadowOpacity={selected ? 0.18 : 0}
      />
      <Text
        x={-w / 2}
        y={-d / 2}
        width={w}
        height={d}
        align="center"
        verticalAlign="middle"
        text={`${item.name}\n${unitsLabel}`}
        fontSize={Math.max(10, Math.min(w, d) * 0.16)}
        fontStyle="600"
        fill="#fdfaf3"
        listening={false}
      />
      {/* Estimated-dimensions badge: a gold dot at a solid corner. */}
      {item.confidence === 'estimated' && (
        <Circle
          x={anchor.x * pxPerMm}
          y={anchor.y * pxPerMm}
          radius={5 / viewScale}
          fill="#c8970a"
          stroke="#fdfaf3"
          strokeWidth={1.5 / viewScale}
          listening={false}
        />
      )}
    </Group>
  );
}
