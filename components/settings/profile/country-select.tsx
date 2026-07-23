'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { COUNTRIES } from '@/lib/onboarding/countries';
import { cn } from '@/lib/utils';

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
          'flex w-full items-center justify-between gap-2 rounded-xl border py-2.5 pl-4 text-left text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent/30',
          value ? 'pr-10' : 'pr-4',
          isOpen
            ? 'border-nham-accent bg-white'
            : 'border-nham-border bg-white hover:border-nham-accent/50'
        )}
      >
        <span
          className={cn(
            'min-w-0 truncate',
            value ? 'text-nham-text' : 'text-nham-text-muted'
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
          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-nham-text-muted leading-none transition-colors hover:text-nham-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent/30"
        >
          ×
        </button>
      )}

      {isOpen && (
        <div className="absolute z-[120] mt-1 w-full overflow-hidden rounded-xl border border-nham-border bg-white shadow-lg">
          <div className="border-nham-border border-b p-2">
            <input
              type="text"
              value={search}
              ref={(el) => el?.focus()}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={tRegional('searchCountryLabel')}
              placeholder={tOrigin('searchCountry')}
              className="w-full rounded-lg bg-nham-track px-3 py-2 text-[13px] outline-none placeholder:text-nham-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent/30"
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-center text-[13px] text-nham-text-muted">
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
                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent/30',
                    value === c.value
                      ? 'bg-nham-hover font-semibold text-nham-text'
                      : 'text-nham-text hover:bg-nham-track'
                  )}
                >
                  <span>{c.value}</span>
                  <span className="text-[11px] text-nham-text-muted">
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
