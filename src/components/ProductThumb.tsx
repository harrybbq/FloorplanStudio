import { useState } from 'react';

/** Simple line icons, used when a product has no image or its image won't load. */
const ICONS: Record<string, string> = {
  Beds: 'M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 15h18M6 10V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3',
  Seating: 'M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M3 11h18v5H3zM5 16v2M19 16v2',
  Storage: 'M5 3h14v18H5zM5 9h14M5 15h14M11 6h2M11 12h2M11 18h2',
  Tables: 'M3 8h18M5 8v11M19 8v11M3 8l2-3h14l2 3',
};
const FALLBACK = 'M4 4h16v16H4z';

/**
 * A product thumbnail loaded straight from the retailer (no referrer sent),
 * or a category icon when there's no image or it fails to load.
 */
export function ProductThumb({ src, category, size = 40 }: { src?: string | null; category?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="flex-shrink-0 rounded-md object-contain bg-white border border-line"
        style={box}
      />
    );
  }
  return (
    <span className="flex-shrink-0 rounded-md bg-bg-overlay border border-line grid place-items-center text-ink-muted" style={box} aria-hidden>
      <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round">
        <path d={ICONS[category ?? ''] ?? FALLBACK} />
      </svg>
    </span>
  );
}
