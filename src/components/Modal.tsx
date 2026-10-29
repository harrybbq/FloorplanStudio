import { useEffect, useId, useRef, type ReactNode } from 'react';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [href], [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal shell: covers the whole app, closes on Esc, keeps Tab inside
 * the dialog, focuses the first field on open, and restores focus on close.
 * The app's global shortcuts check for `[aria-modal="true"]` and stand down.
 */
export function Modal({
  title,
  onClose,
  children,
  width = 400,
  layer = 50,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  /** z-index, so a modal can stack over another (confirm-over-add). */
  layer?: number;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    const first = dialog?.querySelector<HTMLElement>('[data-autofocus]') ?? dialog?.querySelector<HTMLElement>('input, select, textarea') ?? dialog?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    function onKey(e: KeyboardEvent) {
      // With stacked dialogs, only the top one reacts.
      const topmost = Array.from(document.querySelectorAll('[aria-modal="true"]')).pop();
      if (!dialog || topmost !== dialog) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === 'Tab') {
        const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null);
        if (items.length === 0) return;
        const firstItem = items[0];
        const lastItem = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstItem) {
          e.preventDefault();
          lastItem.focus();
        } else if (!e.shiftKey && document.activeElement === lastItem) {
          e.preventDefault();
          firstItem.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-ink/30 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: layer }}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="panel max-h-[85vh] flex flex-col shadow-lg"
        style={{ width, maxWidth: '100%' }}
      >
        <h2 id={titleId} className="font-display text-lg px-5 pt-5">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
