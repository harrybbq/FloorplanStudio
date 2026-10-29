/** A compact single-choice toggle (e.g. mm/in, Rectangle/L-shape). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  /** Accessible name for the group. */
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-md border border-line overflow-hidden">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          className={`px-2.5 py-1 text-xs font-medium transition-colors ${
            value === o.value ? 'bg-em text-white' : 'text-ink-mid hover:bg-bg-overlay'
          }`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
