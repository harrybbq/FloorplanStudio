import { describe, expect, it } from 'vitest';
import { floorplanSources, measurementLink, parseHandoff, planMeasurement } from '../handoff';
import type { PlanLink, Room } from '../../types';

const FLOORPLAN = 'https://media.rightmove.co.uk/property-floorplan/a.jpeg';

function hash(params: Record<string, string>): string {
  return '#' + new URLSearchParams({ from: 'househunter', listing: 'rm-1', floorplan: FLOORPLAN, ...params });
}

describe('parseHandoff', () => {
  it('reads a HouseHunter hand-off', () => {
    const h = parseHandoff(
      hash({
        name: 'Garthland Drive 2/1',
        page: 'https://www.rightmove.co.uk/properties/1',
        return: 'http://localhost:5190/#listing=rm-1',
        relay: 'http://localhost:5190/api/floorplan-image',
      })
    );
    expect(h).toEqual({
      name: 'Garthland Drive 2/1',
      link: {
        app: 'househunter',
        listingId: 'rm-1',
        floorplanUrl: FLOORPLAN,
        listingUrl: 'https://www.rightmove.co.uk/properties/1',
        returnUrl: 'http://localhost:5190/#listing=rm-1',
      },
      relayUrl: 'http://localhost:5190/api/floorplan-image',
    });
  });

  it('ignores other hashes and incomplete hand-offs', () => {
    expect(parseHandoff('')).toBeNull();
    expect(parseHandoff('#listing=rm-1')).toBeNull();
    expect(parseHandoff(hash({ listing: ' ' }))).toBeNull();
    expect(parseHandoff(hash({ floorplan: 'not a url' }))).toBeNull();
    expect(parseHandoff(hash({ floorplan: 'http://insecure.example/a.jpeg' }))).toBeNull();
  });

  it('drops unsafe links and relays that are not on this machine', () => {
    const h = parseHandoff(
      hash({ page: 'javascript:alert(1)', return: 'data:text/html,hi', relay: 'http://evil.example/relay' })
    )!;
    expect(h.link.listingUrl).toBeNull();
    expect(h.link.returnUrl).toBeNull();
    expect(h.relayUrl).toBeNull();
    expect(parseHandoff(hash({ relay: 'https://localhost:5190/r' }))!.relayUrl).toBeNull();
    expect(parseHandoff(hash({ relay: 'http://127.0.0.1:5190/r' }))!.relayUrl).toBe('http://127.0.0.1:5190/r');
  });

  it('defaults and caps the plan name', () => {
    expect(parseHandoff(hash({}))!.name).toBe('HouseHunter listing');
    expect(parseHandoff(hash({ name: 'x'.repeat(500) }))!.name).toHaveLength(120);
  });
});

describe('floorplanSources', () => {
  it('tries the relay first, then the image itself', () => {
    const h = parseHandoff(hash({ relay: 'http://localhost:5190/api/floorplan-image' }))!;
    expect(floorplanSources(h)).toEqual([
      `http://localhost:5190/api/floorplan-image?url=${encodeURIComponent(FLOORPLAN)}`,
      FLOORPLAN,
    ]);
    expect(floorplanSources(parseHandoff(hash({}))!)).toEqual([FLOORPLAN]);
  });
});

const rect = (w: number, h: number) => [
  { x: 0, y: 0 },
  { x: w, y: 0 },
  { x: w, y: h },
  { x: 0, y: h },
];
const room = (role: Room['role'], w: number, h: number): Room => ({ id: role, role, points: rect(w, h) });

describe('planMeasurement', () => {
  it('measures the marked rooms in metres and sq ft (0.1 px per mm)', () => {
    const rooms = [room('flat', 950, 900), room('kitchen', 391, 493), room('bedroom2', 295, 458), room('other', 100, 100)];
    // 9.5 × 9 m = 85.5 m² = 920 sq ft
    expect(planMeasurement(rooms, 0.1)).toEqual({ sqft: 920, kitchen: [4.93, 3.91], bed2: [4.58, 2.95] });
  });

  it('sends nothing for unmarked rooms', () => {
    expect(planMeasurement([room('other', 500, 400)], 0.1)).toEqual({ sqft: null, kitchen: null, bed2: null });
  });
});

describe('measurementLink', () => {
  const link: PlanLink = {
    app: 'househunter',
    listingId: 'rm-1',
    floorplanUrl: FLOORPLAN,
    listingUrl: null,
    returnUrl: 'http://localhost:5190/#listing=rm-1',
  };

  it('opens the listing in HouseHunter with the measurements', () => {
    const url = measurementLink(link, { sqft: 920, kitchen: [4.93, 3.91], bed2: null })!;
    expect(url.startsWith('http://localhost:5190/#')).toBe(true);
    const p = new URLSearchParams(url.split('#')[1]);
    expect(Object.fromEntries(p)).toEqual({ listing: 'rm-1', from: 'floorplanstudio', sqft: '920', kitchen: '4.93x3.91' });
  });

  it('is null with nothing to send or no way back', () => {
    expect(measurementLink(link, { sqft: null, kitchen: null, bed2: null })).toBeNull();
    expect(measurementLink({ ...link, returnUrl: null }, { sqft: 920, kitchen: null, bed2: null })).toBeNull();
  });
});
