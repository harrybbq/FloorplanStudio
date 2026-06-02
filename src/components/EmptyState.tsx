import { useEffect, useRef } from 'react';
import { usePlanStore } from '../state/planStore';

/**
 * Shown when the active plan has no image. Handles paste, drag-drop, and click-to-upload.
 */
export function EmptyState() {
  const setPlanImage = usePlanStore(s => s.setPlanImage);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new window.Image();
      img.onload = () => setPlanImage(dataUrl, img.naturalWidth, img.naturalHeight);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.type.startsWith('image/')) {
          const file = it.getAsFile();
          if (file) handleFile(file);
          break;
        }
      }
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  return (
    <div
      className="w-full h-full flex items-center justify-center p-8"
      onDragOver={e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={e => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
      }}
    >
      <div className="panel max-w-md w-full p-10 text-center border-dashed border-2">
        <h2 className="font-display text-2xl text-em mb-2">Drop a floorplan</h2>
        <p className="text-ink-mid text-sm mb-5">
          Paste an image (<kbd className="px-1.5 py-0.5 bg-bg-overlay border border-line rounded text-xs font-mono">Ctrl/⌘+V</kbd>),
          drag a file here, or click below.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
        <button className="btn-primary" onClick={() => inputRef.current?.click()}>
          Choose image
        </button>
        <p className="text-xs text-ink-muted mt-6">
          Next: click two points on a known distance to set the scale.
        </p>
      </div>
    </div>
  );
}
