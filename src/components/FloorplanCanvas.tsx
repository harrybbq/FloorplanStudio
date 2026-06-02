import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Group, Text, Line, Circle } from 'react-konva';
import type Konva from 'konva';
import { usePlanStore, commitCalibrationWithPoints } from '../state/planStore';
import { formatLength } from '../lib/units';
import type { FurnitureItem, Point } from '../types';
import { CalibrationDistanceModal } from './CalibrationDistanceModal';

/**
 * The drawing surface. Owns:
 *   - Image loading + auto-fit
 *   - Pan/zoom (wheel zoom, middle/right drag pan)
 *   - Calibration click handling
 *   - Furniture placement on click (when mode === 'placing')
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
  const selectedId = usePlanStore(s => s.selectedFurnitureId);
  const placingTemplate = usePlanStore(s => s.placingTemplate);
  const imageEl = usePlanStore(s => s.imageElement);

  const addCalibrationPoint = usePlanStore(s => s.addCalibrationPoint);
  const cancelPendingCalibration = usePlanStore(s => s.cancelPendingCalibration);
  const placeFurnitureAt = usePlanStore(s => s.placeFurnitureAt);
  const selectFurniture = usePlanStore(s => s.selectFurniture);
  const updateFurniture = usePlanStore(s => s.updateFurniture);
  const setImageElement = usePlanStore(s => s.setImageElement);

  // — container size —
  const [size, setSize] = useState({ w: 800, h: 600 });
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        setSize({ w: Math.floor(width), h: Math.floor(height) });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // — stage view transform (zoom + pan) —
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });

  // — load image when plan.imageDataUrl changes —
  useEffect(() => {
    if (!plan?.imageDataUrl) {
      setImageElement(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => setImageElement(img);
    img.src = plan.imageDataUrl;
  }, [plan?.id, plan?.imageDataUrl, setImageElement]);

  // — auto-fit when image or container size changes —
  useEffect(() => {
    if (!imageEl || !plan) return;
    const padding = 40;
    const sx = (size.w - padding * 2) / imageEl.naturalWidth;
    const sy = (size.h - padding * 2) / imageEl.naturalHeight;
    const scale = Math.min(sx, sy, 1);
    setView({
      scale,
      x: (size.w - imageEl.naturalWidth * scale) / 2,
      y: (size.h - imageEl.naturalHeight * scale) / 2,
    });
  }, [imageEl, plan?.id, size.w, size.h]);

  // — pending second point for calibration (preview) —
  const [pendingSecond, setPendingSecond] = useState<Point | null>(null);
  const [calibrationDialogOpen, setCalibrationDialogOpen] = useState(false);

  // Convert a screen-space pointer position to image-space.
  function getImagePoint(): Point | null {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    return {
      x: (pos.x - view.x) / view.scale,
      y: (pos.y - view.y) / view.scale,
    };
  }

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (!plan) return;
    // ignore clicks that hit furniture (those bubble up but the furniture group handles them)
    const clickedEmpty = e.target === e.target.getStage() || e.target.name() === 'background';
    const pt = getImagePoint();
    if (!pt) return;

    if (mode === 'calibrate') {
      if (!pendingPoint) {
        addCalibrationPoint(pt);
      } else {
        setPendingSecond(pt);
        setCalibrationDialogOpen(true);
      }
      return;
    }

    if (mode === 'placing' && placingTemplate) {
      placeFurnitureAt(pt.x, pt.y);
      return;
    }

    if (mode === 'select' && clickedEmpty) {
      selectFurniture(null);
    }
  }

  // Mouse-move ghost for calibration second point + placing preview.
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  function handleStageMouseMove() {
    const pt = getImagePoint();
    if (pt) setHoverPoint(pt);
  }

  // Wheel zoom.
  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const oldScale = view.scale;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const factor = 1.1;
    const newScale = Math.max(0.05, Math.min(8, oldScale * (direction > 0 ? factor : 1 / factor)));
    const worldX = (pointer.x - view.x) / oldScale;
    const worldY = (pointer.y - view.y) / oldScale;
    setView({
      scale: newScale,
      x: pointer.x - worldX * newScale,
      y: pointer.y - worldY * newScale,
    });
  }

  // Pan via middle-mouse drag.
  const panState = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });
  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.evt.button === 1 || (e.evt.button === 0 && e.evt.altKey)) {
      e.evt.preventDefault();
      panState.current = { active: true, lastX: e.evt.clientX, lastY: e.evt.clientY };
    }
  }
  function handleMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    handleStageMouseMove();
    if (panState.current.active) {
      const dx = e.evt.clientX - panState.current.lastX;
      const dy = e.evt.clientY - panState.current.lastY;
      panState.current.lastX = e.evt.clientX;
      panState.current.lastY = e.evt.clientY;
      setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
    }
  }
  function handleMouseUp() {
    panState.current.active = false;
  }

  // Escape to cancel pending calibration / placing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (mode === 'calibrate') cancelPendingCalibration();
        if (mode === 'placing') usePlanStore.getState().cancelPlacing();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, cancelPendingCalibration]);

  const pxPerMm = plan?.calibration?.pxPerMm ?? null;

  if (!plan) return null;

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        scaleX={view.scale}
        scaleY={view.scale}
        x={view.x}
        y={view.y}
        onClick={handleStageClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{
          cursor:
            mode === 'calibrate' || mode === 'placing'
              ? 'crosshair'
              : panState.current.active
              ? 'grabbing'
              : 'default',
        }}
      >
        <Layer>
          {/* background hit-target so empty-space clicks register */}
          {imageEl && (
            <Rect
              name="background"
              x={0}
              y={0}
              width={imageEl.naturalWidth}
              height={imageEl.naturalHeight}
              fill="transparent"
              listening
            />
          )}
          {imageEl && (
            <KonvaImage
              image={imageEl}
              x={0}
              y={0}
              width={imageEl.naturalWidth}
              height={imageEl.naturalHeight}
              listening={false}
              opacity={mode === 'placing' ? 0.85 : 1}
            />
          )}

          {/* Committed calibration line */}
          {plan.calibration && (
            <CalibrationLine
              p1={plan.calibration.points[0]}
              p2={plan.calibration.points[1]}
              distanceLabel={formatLength(plan.calibration.distanceMm, units)}
              viewScale={view.scale}
            />
          )}

          {/* Pending calibration first point */}
          {mode === 'calibrate' && pendingPoint && !pendingSecond && (
            <>
              <Circle x={pendingPoint.x} y={pendingPoint.y} radius={6 / view.scale} fill="#d4700a" />
              {hoverPoint && (
                <Line
                  points={[pendingPoint.x, pendingPoint.y, hoverPoint.x, hoverPoint.y]}
                  stroke="#d4700a"
                  strokeWidth={2 / view.scale}
                  dash={[8 / view.scale, 6 / view.scale]}
                />
              )}
            </>
          )}

          {/* Placing preview (ghost rectangle following the cursor) */}
          {mode === 'placing' && placingTemplate && hoverPoint && pxPerMm && (
            <PlacingGhost
              x={hoverPoint.x}
              y={hoverPoint.y}
              widthPx={placingTemplate.widthMm * pxPerMm}
              depthPx={placingTemplate.depthMm * pxPerMm}
            />
          )}

          {/* Furniture */}
          {pxPerMm &&
            plan.furniture.map(item => (
              <FurnitureRect
                key={item.id}
                item={item}
                pxPerMm={pxPerMm}
                viewScale={view.scale}
                selected={selectedId === item.id}
                onSelect={() => selectFurniture(item.id)}
                onDragEnd={(x, y) => updateFurniture(item.id, { x, y })}
                unitsLabel={`${formatLength(item.widthMm, units)} × ${formatLength(item.depthMm, units)}`}
              />
            ))}
        </Layer>
      </Stage>

      {/* Calibration dialog */}
      {calibrationDialogOpen && pendingPoint && pendingSecond && (
        <CalibrationDistanceModal
          units={units}
          onCancel={() => {
            setCalibrationDialogOpen(false);
            setPendingSecond(null);
            cancelPendingCalibration();
          }}
          onCommit={mm => {
            commitCalibrationWithPoints(pendingPoint, pendingSecond, mm);
            setCalibrationDialogOpen(false);
            setPendingSecond(null);
          }}
        />
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function CalibrationLine({
  p1,
  p2,
  distanceLabel,
  viewScale,
}: {
  p1: Point;
  p2: Point;
  distanceLabel: string;
  viewScale: number;
}) {
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  return (
    <Group listening={false}>
      <Line points={[p1.x, p1.y, p2.x, p2.y]} stroke="#1a7a4a" strokeWidth={2 / viewScale} />
      <Circle x={p1.x} y={p1.y} radius={5 / viewScale} fill="#1a7a4a" />
      <Circle x={p2.x} y={p2.y} radius={5 / viewScale} fill="#1a7a4a" />
      <Text
        x={mid.x}
        y={mid.y - 18 / viewScale}
        text={distanceLabel}
        fontSize={13 / viewScale}
        fontStyle="bold"
        fill="#1a7a4a"
        offsetX={distanceLabel.length * 3.2}
      />
    </Group>
  );
}

function PlacingGhost({
  x,
  y,
  widthPx,
  depthPx,
}: {
  x: number;
  y: number;
  widthPx: number;
  depthPx: number;
}) {
  return (
    <Rect
      x={x}
      y={y}
      width={widthPx}
      height={depthPx}
      offsetX={widthPx / 2}
      offsetY={depthPx / 2}
      fill="#1a7a4a"
      opacity={0.32}
      stroke="#1a7a4a"
      strokeWidth={1.5}
      dash={[6, 4]}
      listening={false}
    />
  );
}

function FurnitureRect({
  item,
  pxPerMm,
  viewScale,
  selected,
  onSelect,
  onDragEnd,
  unitsLabel,
}: {
  item: FurnitureItem;
  pxPerMm: number;
  viewScale: number;
  selected: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  unitsLabel: string;
}) {
  const w = item.widthMm * pxPerMm;
  const d = item.depthMm * pxPerMm;
  const labelText = `${item.name}\n${unitsLabel}`;
  const labelFont = useMemo(() => Math.max(10, Math.min(w, d) * 0.16), [w, d]);

  return (
    <Group
      x={item.x}
      y={item.y}
      rotation={item.rotation}
      draggable
      onClick={e => {
        e.cancelBubble = true;
        onSelect();
      }}
      onTap={e => {
        e.cancelBubble = true;
        onSelect();
      }}
      onDragStart={() => onSelect()}
      onDragEnd={e => onDragEnd(e.target.x(), e.target.y())}
    >
      <Rect
        x={0}
        y={0}
        width={w}
        height={d}
        offsetX={w / 2}
        offsetY={d / 2}
        fill={item.color}
        opacity={0.78}
        stroke={selected ? '#1c1a17' : '#1c1a17'}
        strokeWidth={(selected ? 2.5 : 1) / viewScale}
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
        text={labelText}
        fontSize={labelFont}
        fontStyle="600"
        fill="#fdfaf3"
        listening={false}
      />
    </Group>
  );
}
