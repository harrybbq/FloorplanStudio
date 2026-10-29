import { useCallback } from 'react';
import { usePlanStore } from './planStore';
import { readImageFile } from '../lib/image';

/**
 * Returns `importImage(file)` — used by upload, paste and drag-drop alike.
 * Confirms before replacing an image the user has already started working on
 * (calibration resets, and existing furniture keeps its old pixel positions).
 */
export function useImageImport(): (file: Blob) => Promise<void> {
  const setPlanImage = usePlanStore(s => s.setPlanImage);
  return useCallback(
    async (file: Blob) => {
      const plan = usePlanStore.getState().active();
      const hasWork = !!plan?.imageDataUrl && (!!plan.calibration || plan.furniture.length > 0 || plan.walls.length > 0);
      if (
        hasWork &&
        !confirm('Replace the floorplan image? The scale resets, and existing furniture and walls keep their positions, so they may no longer line up.')
      ) {
        return;
      }
      try {
        setPlanImage(await readImageFile(file));
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Could not load that image.');
      }
    },
    [setPlanImage]
  );
}
