import { describe, expect, it } from 'vitest';
import { matchCatalog } from '../furniture/sampleCatalog';

const name = (q: string) => matchCatalog(q)?.name ?? null;

describe('matchCatalog', () => {
  it('matches case- and whitespace-insensitively', () => {
    expect(name('  IKEA   BILLY bookcase ')).toBe('IKEA Billy bookcase');
  });

  it('prefers the longest matching alias', () => {
    expect(name('lack side table')).toBe('IKEA Lack side table');
    expect(name('lack')).toBe('IKEA Lack coffee table');
    expect(name('kallax 2x4')).toBe('IKEA Kallax 2x4 shelf');
    expect(name('kallax')).toBe('IKEA Kallax 4x4 shelf');
  });

  it('covers B&Q and Tesco', () => {
    expect(name('form darwin')).toMatch(/^B&Q/);
    expect(name('tesco sofa')).toMatch(/^Tesco/);
  });

  it('matches whole words only', () => {
    expect(name('black sofa')).toBeNull(); // not "b-lack"
    expect(name('black pax wardrobe')).toBe('IKEA Pax wardrobe (2-door)');
  });

  it('ignores punctuation, "&" vs "and", and accents', () => {
    expect(name('B & Q wardrobe')).toMatch(/^B&Q/);
    expect(name('b and q wardrobe')).toMatch(/^B&Q/);
    expect(name('Fox and Ivy wardrobe')).toMatch(/^Tesco/);
    expect(name('poäng')).toBe('IKEA Poäng armchair');
    expect(name('poäng')).toBe('IKEA Poäng armchair'); // decomposed ä
    expect(name('Malm 6-drawer chest')).toBe('IKEA Malm 6-drawer chest');
  });

  it('resolves bare range names', () => {
    expect(name('ikea malm')).toBe('IKEA Malm bed frame (double)');
  });

  it('returns null for unknown or empty queries', () => {
    expect(name('random thing')).toBeNull();
    expect(name('')).toBeNull();
  });
});
