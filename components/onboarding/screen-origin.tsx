'use client';

import { Globe, MapPin } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { COUNTRIES } from '@/lib/onboarding/countries';

interface ScreenOriginProps {
  defaultValues: {
    countryOfOrigin: string | null;
    countryOfResidence: string | null;
  };
  onChange: (data: {
    countryOfOrigin: string | null;
    countryOfResidence: string | null;
  }) => void;
}

interface CountryPickerProps {
  label: string;
  hint: string;
  icon: React.ReactNode;
  value: string | null;
  onChange: (value: string | null) => void;
}

function CountryPicker({
  label,
  hint,
  icon,
  value,
  onChange,
}: CountryPickerProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = search
    ? COUNTRIES.filter(
        (c) =>
          c.value.toLowerCase().includes(search.toLowerCase()) ||
          c.vi.toLowerCase().includes(search.toLowerCase())
      )
    : COUNTRIES;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-2 flex items-center gap-2 font-bold text-[#2C2416] text-[13px]">
        {icon}
        {label}
      </label>
      <p className="mb-3 text-[#8B8682] text-[12px] leading-relaxed">{hint}</p>

      {/* Selected display / trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
          isOpen
            ? 'border-[#C9A87C] bg-white'
            : 'border-[#EAE7E0] bg-[#FDFCF8] hover:border-[#C9A87C]/50'
        }`}
      >
        <span
          className={
            value ? 'text-[#2C2416] text-[14px]' : 'text-[#8B8682] text-[14px]'
          }
        >
          {value
            ? (() => {
                const c = COUNTRIES.find((c) => c.value === value);
                return `${c?.flag ?? ''} ${value} (${c?.vi ?? ''})`;
              })()
            : 'Select a country...'}
        </span>
        <svg
          className={`h-4 w-4 text-[#8B8682] transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-[60] mt-1 w-full overflow-hidden rounded-xl border border-[#EAE7E0] bg-white shadow-lg">
          <div className="border-[#EAE7E0] border-b p-2">
            <input
              type="text"
              value={search}
              ref={(el) => el?.focus()}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search country..."
              className="w-full rounded-lg bg-[#F5F4F0] px-3 py-2 text-[#2C2416] text-[13px] outline-none placeholder:text-[#8B8682]"
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-center text-[#8B8682] text-[13px]">
                No countries found
              </div>
            ) : (
              filtered.map((country) => (
                <button
                  key={country.value}
                  type="button"
                  onClick={() => {
                    onChange(country.value);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                    value === country.value
                      ? 'bg-[#C9A87C]/10 font-medium text-[#2C2416]'
                      : 'text-[#2C2416] hover:bg-[#F5F4F0]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{country.flag}</span>
                    <span>{country.value}</span>
                  </span>
                  <span className="text-[#8B8682] text-[11px]">
                    {country.vi}
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

export function ScreenOrigin({ defaultValues, onChange }: ScreenOriginProps) {
  const [origin, setOrigin] = useState<string | null>(
    defaultValues.countryOfOrigin
  );
  const [residence, setResidence] = useState<string | null>(
    defaultValues.countryOfResidence
  );
  const hasReported = useRef(false);

  const report = useCallback(
    (o: string | null, r: string | null) => {
      onChange({ countryOfOrigin: o, countryOfResidence: r });
    },
    [onChange]
  );

  // Report initial values on mount so wizard knows data is valid
  useEffect(() => {
    if (!hasReported.current) {
      report(origin, residence);
      hasReported.current = true;
    }
  }, [origin, residence, report]);

  return (
    <div className="space-y-8">
      <div>
        <h2
          className="mb-2 font-medium text-2xl text-[#2C2416] tracking-tight"
          style={{ fontFamily: 'Lora, serif' }}
        >
          Where are you from?
        </h2>
        <p
          className="text-[#8B8682] text-[15px] leading-relaxed"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          This helps AI understand your food culture and local ingredients. Both
          fields are optional — skip if you prefer.
        </p>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border border-[#EAE7E0] bg-white p-5">
          <CountryPicker
            label="Country of origin"
            hint="Where you grew up or identify with culinarily"
            icon={<Globe className="h-4 w-4 text-[#C9A87C]" />}
            value={origin}
            onChange={(v) => {
              setOrigin(v);
              report(v, residence);
            }}
          />
        </div>

        <div className="rounded-2xl border border-[#EAE7E0] bg-white p-5">
          <CountryPicker
            label="Country of residence"
            hint="Where you currently live — affects available ingredients"
            icon={<MapPin className="h-4 w-4 text-[#C9A87C]" />}
            value={residence}
            onChange={(v) => {
              setResidence(v);
              report(origin, v);
            }}
          />
        </div>
      </div>
    </div>
  );
}
