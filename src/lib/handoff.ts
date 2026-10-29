import type { PlanLink, Room, RoomRole } from '../types';
import { mm2ToSqft, roomMetrics } from './rooms';

/**
 * HouseHunter's "Plan furniture" button opens FloorplanStudio with a floorplan in
 * the URL hash:
 *
 *   #from=househunter&listing=<id>&name=<address>&floorplan=<image url>
 *    &page=<listing url>&return=<HouseHunter url>&relay=<image relay url>
 *
 * Property sites don't let other origins read their images, so HouseHunter
 * supplies it: first by message from the HouseHunter tab that opened this one
 * (works even from the published site), then through its local dev server
 * (`relay`), which browsers may block a public page from reaching.
 */
export type Handoff = { name: string; link: PlanLink; relayUrl: string | null };

const MAX_NAME = 120;
const MAX_ID = 100;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function webUrl(raw: string | null, protocols = ['http:', 'https:']): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return protocols.includes(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}

export function parseHandoff(hash: string): Handoff | null {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  if (p.get('from') !== 'househunter') return null;
  const listingId = p.get('listing')?.trim().slice(0, MAX_ID);
  const floorplanUrl = webUrl(p.get('floorplan'), ['https:']);
  if (!listingId || !floorplanUrl) return null;

  // Only ever fetch through a relay on this machine.
  const relay = webUrl(p.get('relay'), ['http:']);
  const relayUrl = relay && LOCAL_HOSTS.has(new URL(relay).hostname) ? relay : null;

  return {
    name: (p.get('name')?.trim() || 'HouseHunter listing').slice(0, MAX_NAME),
    link: {
      app: 'househunter',
      listingId,
      floorplanUrl,
      listingUrl: webUrl(p.get('page')),
      returnUrl: webUrl(p.get('return')),
    },
    relayUrl,
  };
}

/** Where to try fetching the floorplan from, best first. */
export function floorplanSources(h: Handoff): string[] {
  const direct = h.link.floorplanUrl;
  if (!h.relayUrl) return [direct];
  const relay = new URL(h.relayUrl);
  relay.searchParams.set('url', direct);
  return [relay.toString(), direct];
}

// Tab-to-tab protocol (HouseHunter's ui/studio.ts answers it):
// we post { type: FLOORPLAN_REQUEST, id, url } to window.opener and wait for
// { type: FLOORPLAN_REPLY, id, url, blob | error } from HouseHunter's origin.
const FLOORPLAN_REQUEST = 'floorplanstudio:floorplan-request';
const FLOORPLAN_REPLY = 'househunter:floorplan';
const OPENER_TIMEOUT_MS = 5000;

/** Ask the HouseHunter tab that opened this one for the image. */
function floorplanFromOpener(h: Handoff): Promise<Blob> {
  const opener = window.opener as Window | null;
  const origin = h.link.returnUrl ? new URL(h.link.returnUrl).origin : null;
  if (!opener || !origin) return Promise.reject(new Error('Not opened from HouseHunter'));
  const id = Math.random().toString(36).slice(2);
  const url = h.link.floorplanUrl;

  return new Promise((resolve, reject) => {
    const finish = (settle: () => void) => {
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      settle();
    };
    // A closed or reloaded HouseHunter tab never answers.
    const timer = setTimeout(() => finish(() => reject(new Error('HouseHunter did not answer'))), OPENER_TIMEOUT_MS);
    function onMessage(e: MessageEvent) {
      const d = e.data as { type?: string; id?: string; url?: string; blob?: unknown; error?: string } | null;
      if (e.origin !== origin || d?.type !== FLOORPLAN_REPLY || d.id !== id || d.url !== url) return;
      const blob = d.blob;
      finish(() =>
        blob instanceof Blob && blob.type.startsWith('image/') ? resolve(blob) : reject(new Error(d.error ?? 'No image'))
      );
    }
    window.addEventListener('message', onMessage);
    // targetOrigin: dropped (and so times out) if the opener is no longer HouseHunter.
    opener.postMessage({ type: FLOORPLAN_REQUEST, id, url }, origin);
  });
}

/** Get the floorplan image: from the HouseHunter tab, then the relay, then directly. Throws if all fail. */
export async function fetchFloorplan(h: Handoff): Promise<Blob> {
  try {
    return await floorplanFromOpener(h);
  } catch {
    // Opened by hand, HouseHunter closed, or the published HouseHunter (no server): try fetching.
  }
  for (const src of floorplanSources(h)) {
    try {
      const res = await fetch(src, { signal: AbortSignal.timeout(15_000) });
      const blob = res.ok ? await res.blob() : null;
      if (blob?.type.startsWith('image/')) return blob;
    } catch {
      // CORS refusal, relay not running, timeout: try the next source.
    }
  }
  throw new Error('Could not fetch the floorplan.');
}

// — the way back: measurements for HouseHunter —

/** Metres, longer side first, as HouseHunter stores room sizes. */
type Dims = [number, number];
export type Measurement = { sqft: number | null; kitchen: Dims | null; bed2: Dims | null };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** What the plan's marked rooms say. Unmarked ('other') rooms aren't sent. */
export function planMeasurement(rooms: Room[], pxPerMm: number): Measurement {
  const metrics = (role: RoomRole) => {
    const room = rooms.find(r => r.role === role);
    return room && room.points.length >= 3 ? roomMetrics(room.points, pxPerMm) : null;
  };
  const dims = (role: RoomRole): Dims | null => {
    const m = metrics(role);
    return m ? [round2(m.lengthMm / 1000), round2(m.widthMm / 1000)] : null;
  };
  const flat = metrics('flat');
  return { sqft: flat ? Math.round(mm2ToSqft(flat.areaMm2)) : null, kitchen: dims('kitchen'), bed2: dims('bedroom2') };
}

/**
 * HouseHunter, opened on the listing with the measurements in its hash. It asks
 * before saving anything. Null when there's nothing to send or no way back.
 */
export function measurementLink(link: PlanLink, m: Measurement): string | null {
  if (!link.returnUrl || (m.sqft === null && !m.kitchen && !m.bed2)) return null;
  const p = new URLSearchParams({ listing: link.listingId, from: 'floorplanstudio' });
  if (m.sqft !== null) p.set('sqft', String(m.sqft));
  if (m.kitchen) p.set('kitchen', m.kitchen.join('x'));
  if (m.bed2) p.set('bed2', m.bed2.join('x'));
  return `${link.returnUrl.split('#')[0]}#${p}`;
}
