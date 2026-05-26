'use client';

import { Globe, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { COUNTRIES } from '@/lib/onboarding/countries';
import type { ProfileFormValues } from './index';

function CountrySelect({
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
        className={`flex w-full items-center justify-between gap-2 rounded-xl border py-2.5 pl-4 text-left text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/30 ${
          value ? 'pr-10' : 'pr-4'
        } ${
          isOpen
            ? 'border-[#C9A87C] bg-white'
            : 'border-[#EAE7E0] bg-[#FDFCF8] hover:border-[#C9A87C]/50'
        }`}
      >
        <span
          className={`min-w-0 truncate ${value ? 'text-[#2C2416]' : 'text-[#7B6F62]'}`}
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
          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-[#7B6F62] leading-none transition-colors hover:text-[#2C2416] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/30"
        >
          ×
        </button>
      )}

      {isOpen && (
        <div className="absolute z-[60] mt-1 w-full overflow-hidden rounded-xl border border-[#EAE7E0] bg-white shadow-lg">
          <div className="border-[#EAE7E0] border-b p-2">
            <input
              type="text"
              value={search}
              ref={(el) => el?.focus()}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={tRegional('searchCountryLabel')}
              placeholder={tOrigin('searchCountry')}
              className="w-full rounded-lg bg-[#F5F4F0] px-3 py-2 text-[13px] outline-none placeholder:text-[#7B6F62] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/30"
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-center text-[#7B6F62] text-[13px]">
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
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/30 ${
                    value === c.value
                      ? 'bg-[#C9A87C]/10 font-medium text-[#2C2416]'
                      : 'text-[#2C2416] hover:bg-[#F5F4F0]'
                  }`}
                >
                  <span>{c.value}</span>
                  <span className="text-[#7B6F62] text-[11px]">{c.vi}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Regional() {
  const tOrigin = useTranslations('onboarding.origin');
  const tRegional = useTranslations('settings.regionalPanel');
  const form = useFormContext<ProfileFormValues>();

  return (
    <div className="space-y-5">
      <p
        className="text-[#7B6F62] text-[14px] leading-relaxed"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        {tRegional('description')}
      </p>

      <div className="space-y-4">
        <FormField
          control={form.control}
          name="countryOfOrigin"
          render={({ field }) => (
            <FormItem>
              <div className="mb-2 flex items-center gap-2 font-medium text-[#2C2416] text-[13px]">
                <Globe className="h-4 w-4 text-[#C9A87C]" />
                {tOrigin('countryOfOrigin')}
              </div>
              <FormControl>
                <CountrySelect value={field.value} onChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="countryOfResidence"
          render={({ field }) => (
            <FormItem>
              <div className="mb-2 flex items-center gap-2 font-medium text-[#2C2416] text-[13px]">
                <MapPin className="h-4 w-4 text-[#C9A87C]" />
                {tOrigin('countryOfResidence')}
              </div>
              <FormControl>
                <CountrySelect value={field.value} onChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
