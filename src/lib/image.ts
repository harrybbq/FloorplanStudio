/**
 * Read a user-supplied floorplan image into a data URL small enough to live in
 * localStorage (~5 MB per origin).
 *
 * Large photos/scans are downscaled so their longest side is MAX_SIDE px and
 * re-encoded as WebP. Small images are kept untouched. This happens before
 * calibration, so the stored pixel space is the one the user calibrates against.
 */
const MAX_SIDE = 2400;
// Base64 inflates ~4/3 and Chrome counts UTF-16 (2 bytes/char), so a 500 KB file
// costs ~1.3 MB of the ~5 MB quota. Anything bigger gets re-encoded.
const KEEP_IF_UNDER_BYTES = 500_000;
const QUALITY = 0.9;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function decode(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = src;
  });
}

/** Returns a data URL for the (possibly downscaled) image. */
export async function readImageFile(file: Blob): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.');
  const original = await readAsDataUrl(file);
  const img = await decode(original);
  const { naturalWidth: w, naturalHeight: h } = img;

  const longest = Math.max(w, h);
  if (longest <= MAX_SIDE && file.size <= KEEP_IF_UNDER_BYTES) {
    return original;
  }

  const scale = Math.min(1, MAX_SIDE / longest);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return original;
  ctx.fillStyle = '#ffffff'; // flatten transparency so lossy encoding doesn't go black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Browsers without WebP encoding silently return PNG — fall back to JPEG then.
  let dataUrl = canvas.toDataURL('image/webp', QUALITY);
  if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
  // Never make things worse.
  return dataUrl.length < original.length ? dataUrl : original;
}

/** First image file in a paste/drop payload, if any. */
export function imageFromItems(items: DataTransferItemList | undefined | null): File | null {
  if (!items) return null;
  for (const it of Array.from(items)) {
    if (it.kind === 'file' && it.type.startsWith('image/')) return it.getAsFile();
  }
  return null;
}
