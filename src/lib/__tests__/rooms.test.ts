import { describe, expect, it } from 'vitest';
import { formatArea, minAreaRect, polygonArea, roomMetrics, straighten } from '../rooms';
import type { Point } from '../../types';

const rect = (w: number, h: number, x = 0, y = 0): Point[] => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

function rotate(points: Point[], deg: number): Point[] {
  const r = (deg * Math.PI) / 180;
  return points.map(p => ({ x: p.x * Math.cos(r) - p.y * Math.sin(r), y: p.x * Math.sin(r) + p.y * Math.cos(r) }));
}

describe('minAreaRect', () => {
  it('gives the sides of an axis-aligned rectangle, longer first', () => {
    expect(minAreaRect(rect(3000, 4000))).toEqual({ length: 4000, width: 3000 });
  });

  it('gives the real sides however the rectangle is rotated', () => {
    const { length, width } = minAreaRect(rotate(rect(4580, 2950), 33));
    expect(length).toBeCloseTo(4580, 6);
    expect(width).toBeCloseTo(2950, 6);
  });

  it('gives the overall extent of an L-shaped room', () => {
    const L = [
      { x: 0, y: 0 },
      { x: 5000, y: 0 },
      { x: 5000, y: 2000 },
      { x: 2000, y: 2000 },
      { x: 2000, y: 4000 },
      { x: 0, y: 4000 },
    ];
    expect(minAreaRect(L)).toEqual({ length: 5000, width: 4000 });
    expect(polygonArea(L)).toBe(5000 * 2000 + 2000 * 2000);
  });

  it('survives degenerate input', () => {
    expect(minAreaRect([])).toEqual({ length: 0, width: 0 });
    expect(minAreaRect([{ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1 }])).toEqual({ length: 0, width: 0 });
  });
});

describe('roomMetrics', () => {
  it('converts image pixels to mm with the calibration', () => {
    // 0.1 px per mm: a 391 × 493 px room is 3.91 × 4.93 m.
    const m = roomMetrics(rect(391, 493, 50, 80), 0.1);
    expect(m.lengthMm).toBeCloseTo(4930, 6);
    expect(m.widthMm).toBeCloseTo(3910, 6);
    expect(m.areaMm2).toBeCloseTo(3910 * 4930, 0);
  });
});

describe('formatArea', () => {
  it('shows m² or sq ft', () => {
    expect(formatArea(19_276_300, 'metric')).toBe('19.3 m²');
    expect(formatArea(19_276_300, 'imperial')).toBe('207 sq ft');
  });
});

describe('straighten', () => {
  const from = { x: 0, y: 0 };
  it('snaps near-horizontal and near-vertical edges', () => {
    expect(straighten(from, { x: 100, y: 5 }, 6)).toEqual({ x: 100, y: 0 });
    expect(straighten(from, { x: -4, y: 100 }, 6)).toEqual({ x: 0, y: 100 });
  });
  it('leaves diagonals and the first point alone', () => {
    expect(straighten(from, { x: 100, y: 60 }, 6)).toEqual({ x: 100, y: 60 });
    expect(straighten(undefined, { x: 3, y: 4 }, 6)).toEqual({ x: 3, y: 4 });
  });
});
