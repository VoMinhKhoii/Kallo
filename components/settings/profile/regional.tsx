'use client';

import { Globe, Languages, MapPin } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { LanguageToggle } from '@/components/onboarding/language-toggle';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { useLocaleSwitch } from '@/hooks/profile/use-locale-switch';
import type { Locale } from '@/i18n/config';
import { COUNTRIES } from '@/lib/onboarding/countries';
import { cn } from '@/lib/utils';
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
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl border py-2.5 pl-4 text-left text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent/30',
          value ? 'pr-10' : 'pr-4',
          isOpen
            ? 'border-nham-accent bg-white'
            : 'border-[#EAE7E0] bg-[#FDFCF8] hover:border-nham-accent/50'
        )}
      >
        <span
          className={cn(
            'min-w-0 truncate',
            value ? 'text-nham-text' : 'text-[#7B6F62]'
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
          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-[#7B6F62] leading-none transition-colors hover:text-nham-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent/30"
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
              className="w-full rounded-lg bg-nham-track px-3 py-2 text-[13px] outline-none placeholder:text-[#7B6F62] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent/30"
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
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent/30',
                    value === c.value
                      ? 'bg-nham-accent/10 font-medium text-nham-text'
                      : 'text-nham-text hover:bg-nham-track'
                  )}
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
  const tSettings = useTranslations('settings');
  const locale = useLocale();
  const switchLocale = useLocaleSwitch();
  const form = useFormContext<ProfileFormValues>();

  return (
    <div className="space-y-5">
      <p className="font-sans-display text-[#7B6F62] text-[14px] leading-relaxed">
        {tRegional('description')}
      </p>

      {/* Language — the only post-onboarding way to change app language (the
          settings.language keys were orphaned). Switches the locale in place;
          it lives outside the profile form's dirty state. */}
      <div>
        <div className="mb-2 flex items-center gap-2 font-medium text-[13px] text-nham-text">
          <Languages className="h-4 w-4 text-nham-accent" />
          {tSettings('language')}
        </div>
        <LanguageToggle
          value={locale}
          onChange={(next) => switchLocale(next as Locale)}
        />
        <p className="mt-1.5 text-[#7B6F62] text-[12px]">
          {tSettings('languageHint')}
        </p>
      </div>

      <div className="space-y-4">
        <FormField
          control={form.control}
          name="countryOfOrigin"
          render={({ field }) => (
            <FormItem>
              <div className="mb-2 flex items-center gap-2 font-medium text-[13px] text-nham-text">
                <Globe className="h-4 w-4 text-nham-accent" />
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
              <div className="mb-2 flex items-center gap-2 font-medium text-[13px] text-nham-text">
                <MapPin className="h-4 w-4 text-nham-accent" />
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
