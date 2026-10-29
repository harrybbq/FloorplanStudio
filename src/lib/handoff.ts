import type { PlanLink } from '../types';

/**
 * HouseHunter's "Plan furniture" button opens FloorplanStudio with a floorplan in
 * the URL hash:
 *
 *   #from=househunter&listing=<id>&name=<address>&floorplan=<image url>
 *    &page=<listing url>&return=<HouseHunter url>&relay=<image relay url>
 *
 * Property sites don't let other origins read their images, so the image comes
 * through HouseHunter's local dev server (`relay`) when it's running.
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

/** Fetch the floorplan image, trying the relay first. Throws if every source fails. */
export async function fetchFloorplan(h: Handoff): Promise<Blob> {
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
