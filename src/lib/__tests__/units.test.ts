import { describe, expect, it } from 'vitest';
import { formatLength, parseLength } from '../units';

describe('parseLength', () => {
  it('reads bare numbers in the active unit system', () => {
    expect(parseLength('1500', 'metric')).toBe(1500);
    expect(parseLength('10', 'imperial')).toBeCloseTo(254);
  });

  it('reads explicit units', () => {
    expect(parseLength('1.5m', 'imperial')).toBe(1500);
    expect(parseLength('20cm', 'metric')).toBe(200);
    expect(parseLength('12in', 'metric')).toBeCloseTo(304.8);
    expect(parseLength('3ft', 'metric')).toBeCloseTo(914.4);
    expect(parseLength(`3'6"`, 'metric')).toBeCloseTo(1066.8);
  });

  it('reads the forms people actually type', () => {
    expect(parseLength('1,500', 'metric')).toBe(1500);
    expect(parseLength('5’6”', 'metric')).toBeCloseTo(1676.4); // smart quotes
    expect(parseLength(`5'6''`, 'metric')).toBeCloseTo(1676.4);
    expect(parseLength('5ft 6in', 'metric')).toBeCloseTo(1676.4);
    expect(parseLength('5 feet 6 inches', 'metric')).toBeCloseTo(1676.4);
    expect(parseLength(`3'-6"`, 'metric')).toBeCloseTo(1066.8);
    expect(parseLength('.5m', 'metric')).toBe(500);
  });

  it('rejects garbage, negatives and impossible inches', () => {
    expect(parseLength('', 'metric')).toBeNull();
    expect(parseLength('abc', 'metric')).toBeNull();
    expect(parseLength('-500', 'metric')).toBeNull();
    expect(parseLength(`3'14"`, 'metric')).toBeNull();
  });
});

describe('formatLength', () => {
  it('formats metric', () => {
    expect(formatLength(850, 'metric')).toBe('850 mm');
    expect(formatLength(1500, 'metric')).toBe('1.50 m');
  });

  it('formats imperial', () => {
    expect(formatLength(254, 'imperial')).toBe('10.0″');
    expect(formatLength(914.4, 'imperial')).toBe('3′0.0″');
  });

  it('carries rounding into the next foot / metre', () => {
    expect(formatLength(608.6, 'imperial')).toBe('2′0.0″'); // 23.96″, not 1′12.0″
    expect(formatLength(303.8, 'imperial')).toBe('1′0.0″');
    expect(formatLength(999.6, 'metric')).toBe('1.00 m');
  });
});
