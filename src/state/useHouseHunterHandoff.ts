import { useEffect, useState } from 'react';
import { usePlanStore } from './planStore';
import { fetchFloorplan, parseHandoff } from '../lib/handoff';
import { readImageFile } from '../lib/image';

export type HandoffStatus = { planId: string; state: 'loading' | 'failed'; floorplanUrl: string } | null;

/** Lets HouseHunter's "Plan furniture" links target this tab when it's already open. */
const WINDOW_NAME = 'floorplanstudio';

/**
 * Opens the plan for a floorplan handed over by HouseHunter in the URL hash (see
 * lib/handoff.ts), on load and whenever the hash changes. Must run before
 * `ensureInitialPlan`, so a first visit doesn't also create an empty plan.
 */
export function useHouseHunterHandoff(): [HandoffStatus, () => void] {
  const [status, setStatus] = useState<HandoffStatus>(null);

  useEffect(() => {
    window.name = WINDOW_NAME;

    function consume() {
      const h = parseHandoff(window.location.hash);
      if (!h) return;
      // Clear it so a reload (or StrictMode's second effect run) doesn't import again.
      history.replaceState(null, '', window.location.pathname + window.location.search);

      const planId = usePlanStore.getState().openLinkedPlan(h.link, h.name);
      const hasImage = () => !!usePlanStore.getState().plans.find(p => p.id === planId)?.imageDataUrl;
      if (hasImage()) return setStatus(null);

      const settle = (next: HandoffStatus) => setStatus(cur => (cur?.planId === planId ? next : cur));
      setStatus({ planId, state: 'loading', floorplanUrl: h.link.floorplanUrl });
      // Deliberately not cancelled on cleanup: it writes to this plan by id.
      fetchFloorplan(h)
        .then(readImageFile)
        .then(
          dataUrl => {
            // The user may have pasted the image themselves in the meantime.
            if (!hasImage()) usePlanStore.getState().setPlanImage(dataUrl, null, planId);
            settle(null);
          },
          () => settle({ planId, state: 'failed', floorplanUrl: h.link.floorplanUrl })
        );
    }

    consume();
    window.addEventListener('hashchange', consume);
    return () => window.removeEventListener('hashchange', consume);
  }, []);

  return [status, () => setStatus(null)];
}
