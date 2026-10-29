import type { Calibration } from '../types';

/**
 * A generated sample floorplan (12 m × 8 m flat) with its scale already set, so
 * first-time users can try placing furniture without hunting for an image.
 * Drawn at 10 mm per pixel; the scale bar along the bottom doubles as the
 * calibration reference.
 */
const PX_PER_M = 100;
const W = 12 * PX_PER_M + 80;
const H = 8 * PX_PER_M + 120;
const OX = 40; // plan origin inside the image
const OY = 40;

export function createSamplePlan(): { dataUrl: string; calibration: Calibration } {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  const m = (v: number) => v * PX_PER_M; // metres → px

  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);

  // Walls as [x1, y1, x2, y2] in metres. Gaps are doorways.
  const walls: [number, number, number, number][] = [
    // outer shell (front door gap on the bottom edge, 5.0–6.0 m)
    [0, 0, 12, 0], [12, 0, 12, 8], [12, 8, 6, 8], [5, 8, 0, 8], [0, 8, 0, 0],
    // living | kitchen/bed split at x = 7, doorways at y 2.2–3.2 and 5.4–6.4
    [7, 0, 7, 2.2], [7, 3.2, 7, 5.4], [7, 6.4, 7, 8],
    // kitchen | bedroom split at y = 4, doorway at x 9.5–10.5
    [7, 4, 9.5, 4], [10.5, 4, 12, 4],
    // bathroom in the bedroom's corner, doorway at y 6.6–7.4
    [10, 6, 12, 6], [10, 6, 10, 6.6], [10, 7.4, 10, 8],
  ];
  g.strokeStyle = '#3a3530';
  g.lineCap = 'square';
  for (const [x1, y1, x2, y2] of walls) {
    const outer = x1 === 0 || x2 === 0 || y1 === 0 || y2 === 0 || x1 === 12 || x2 === 12 || y1 === 8 || y2 === 8;
    g.lineWidth = outer ? 14 : 8;
    g.beginPath();
    g.moveTo(OX + m(x1), OY + m(y1));
    g.lineTo(OX + m(x2), OY + m(y2));
    g.stroke();
  }

  g.fillStyle = '#8a8278';
  g.font = '600 26px system-ui, sans-serif';
  g.textAlign = 'center';
  const label = (text: string, x: number, y: number) => g.fillText(text, OX + m(x), OY + m(y));
  label('Living room', 3.5, 4);
  label('Kitchen', 9.5, 2);
  label('Bedroom', 8.5, 6.1);
  g.font = '600 20px system-ui, sans-serif';
  label('Bath', 11, 7.1);

  // Scale bar: 0–5 m along the bottom.
  const barY = OY + m(8) + 60;
  const x0 = OX;
  const x1 = OX + m(5);
  g.strokeStyle = '#1a7a4a';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(x0, barY);
  g.lineTo(x1, barY);
  g.moveTo(x0, barY - 10);
  g.lineTo(x0, barY + 10);
  g.moveTo(x1, barY - 10);
  g.lineTo(x1, barY + 10);
  g.stroke();
  g.fillStyle = '#1a7a4a';
  g.font = '600 18px system-ui, sans-serif';
  g.textAlign = 'left';
  g.fillText('5 m', x1 + 12, barY + 6);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    calibration: { points: [{ x: x0, y: barY }, { x: x1, y: barY }], distanceMm: 5000, pxPerMm: (x1 - x0) / 5000 },
  };
}
