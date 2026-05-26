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
    <div className="flex rounded-xl bg-[#F5F4F0] p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex flex-1 flex-col items-center rounded-lg py-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/40 ${
            value === opt.value
              ? 'bg-white text-[#2C2416] shadow-sm'
              : 'text-[#8B8682] hover:text-[#2C2416]'
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
