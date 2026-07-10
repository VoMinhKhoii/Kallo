'use client';

import { GB, VN } from 'country-flag-icons/react/3x2';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LanguageToggleProps {
  value: string;
  onChange: (locale: string) => void;
}

const LANGUAGES = [
  { code: 'en', label: 'English', Flag: GB },
  { code: 'vi', label: 'Tiếng Việt', Flag: VN },
] as const;

export function LanguageToggle({ value, onChange }: LanguageToggleProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {LANGUAGES.map(({ code, label, Flag }) => {
        const selected = value === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => onChange(code)}
            className={cn(
              'flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors',
              selected
                ? 'border-nham-accent bg-nham-accent/10'
                : 'border-[#EAE7E0] bg-[#FDFCF8] hover:border-nham-accent/50'
            )}
          >
            <Flag className="h-5 w-7 shrink-0 rounded-[3px]" />
            <span className="min-w-0 truncate font-medium text-[14px] text-nham-text">
              {label}
            </span>
            {selected && (
              <Check className="ml-auto h-4 w-4 shrink-0 text-nham-accent" />
            )}
          </button>
        );
      })}
    </div>
  );
}
