'use client';

interface OptionStripItem {
  value: string;
  label: string;
  hint?: string;
}

interface OptionStripProps {
  options: OptionStripItem[];
  value: string;
  onChange: (value: string) => void;
}

export function OptionStrip({ options, value, onChange }: OptionStripProps) {
  return (
    <div className="flex rounded-xl bg-nham-track p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex flex-1 flex-col items-center rounded-lg py-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent/40 ${
            value === opt.value
              ? 'bg-white text-nham-text shadow-sm'
              : 'text-[#7B6F62] hover:text-nham-text'
          }`}
        >
          <span className="font-medium text-[13px]">{opt.label}</span>
          {opt.hint && (
            <span className="mt-0.5 text-center text-[10px] leading-tight opacity-70">
              {opt.hint}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
