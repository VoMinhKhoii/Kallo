'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { COUNTRIES } from '@/lib/onboarding/data/countries';
import { cn } from '@/lib/ui/cn';

export function CountrySelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const tOrigin = useTranslations('onboarding.origin');
  const tRegional = useTranslations('settings.regionalPanel');
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filtered = search
    ? COUNTRIES.filter(
        (c) =>
          c.value.toLowerCase().includes(search.toLowerCase()) ||
          c.vi.toLowerCase().includes(search.toLowerCase())
      )
    : COUNTRIES;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl border py-2.5 pl-4 text-left text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/30',
          value ? 'pr-10' : 'pr-4',
          isOpen
            ? 'border-kallo-accent bg-white'
            : 'border-kallo-border bg-white hover:border-kallo-accent/50'
        )}
      >
        <span
          className={cn(
            'min-w-0 truncate',
            value ? 'text-kallo-text' : 'text-kallo-text-muted'
          )}
        >
          {value
            ? (() => {
                const c = COUNTRIES.find((c) => c.value === value);
                return c ? `${value} (${c.vi})` : value;
              })()
            : tOrigin('selectCountry')}
        </span>
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={tRegional('clearLabel')}
          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-kallo-text-muted leading-none transition-colors hover:text-kallo-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/30"
        >
          ×
        </button>
      )}

      {isOpen && (
        <div className="absolute z-[120] mt-1 w-full overflow-hidden rounded-xl border border-kallo-border bg-white shadow-lg">
          <div className="border-kallo-border border-b p-2">
            <input
              type="text"
              value={search}
              ref={(el) => el?.focus()}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={tRegional('searchCountryLabel')}
              placeholder={tOrigin('searchCountry')}
              className="w-full rounded-lg bg-kallo-track px-3 py-2 text-[13px] outline-none placeholder:text-kallo-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/30"
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-center text-[13px] text-kallo-text-muted">
                {tOrigin('noCountries')}
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  aria-current={value === c.value ? 'true' : undefined}
                  onClick={() => {
                    onChange(c.value);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/30',
                    value === c.value
                      ? 'bg-kallo-hover font-semibold text-kallo-text'
                      : 'text-kallo-text hover:bg-kallo-track'
                  )}
                >
                  <span>{c.value}</span>
                  <span className="text-[11px] text-kallo-text-muted">
                    {c.vi}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
