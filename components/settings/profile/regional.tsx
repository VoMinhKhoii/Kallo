'use client';

import { Globe, MapPin } from 'lucide-react';
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
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/30 ${
          isOpen
            ? 'border-[#C9A87C] bg-white'
            : 'border-[#EAE7E0] bg-[#FDFCF8] hover:border-[#C9A87C]/50'
        }`}
      >
        <span className={value ? 'text-[#2C2416]' : 'text-[#8B8682]'}>
          {value
            ? (() => {
                const c = COUNTRIES.find((c) => c.value === value);
                return c ? `${value} (${c.vi})` : value;
              })()
            : 'Select a country…'}
        </span>
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="text-[#8B8682] hover:text-[#2C2416]"
          >
            ×
          </button>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-[60] mt-1 w-full overflow-hidden rounded-xl border border-[#EAE7E0] bg-white shadow-lg">
          <div className="border-[#EAE7E0] border-b p-2">
            <input
              type="text"
              value={search}
              ref={(el) => el?.focus()}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search country"
              placeholder="Search country…"
              className="w-full rounded-lg bg-[#F5F4F0] px-3 py-2 text-[13px] outline-none placeholder:text-[#8B8682] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/30"
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-center text-[#8B8682] text-[13px]">
                No results
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    onChange(c.value);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] ${
                    value === c.value
                      ? 'bg-[#C9A87C]/10 font-medium text-[#2C2416]'
                      : 'text-[#2C2416] hover:bg-[#F5F4F0]'
                  }`}
                >
                  <span>{c.value}</span>
                  <span className="text-[#8B8682] text-[11px]">{c.vi}</span>
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
  const form = useFormContext<ProfileFormValues>();

  return (
    <div className="space-y-5">
      <p
        className="text-[#8B8682] text-[14px] leading-relaxed"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        AI uses your country info to understand food culture and locally
        available ingredients.
      </p>

      <div className="space-y-4">
        <FormField
          control={form.control}
          name="countryOfOrigin"
          render={({ field }) => (
            <FormItem>
              <div className="mb-2 flex items-center gap-2 font-medium text-[#2C2416] text-[13px]">
                <Globe className="h-4 w-4 text-[#C9A87C]" />
                Country of origin
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
                Country of residence
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
