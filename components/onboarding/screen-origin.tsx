'use client';

import { Globe, Languages, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { COUNTRIES } from '@/lib/onboarding/countries';
import { LanguageToggle } from './language-toggle';

interface ScreenOriginProps {
  defaultValues: {
    countryOfOrigin: string | null;
    countryOfResidence: string | null;
    preferredLocale: string;
  };
  onChange: (data: {
    countryOfOrigin: string | null;
    countryOfResidence: string | null;
    preferredLocale: string;
  }) => void;
}

interface CountryPickerProps {
  label: string;
  hint: string;
  icon: React.ReactNode;
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder: string;
  searchPlaceholder: string;
  noResults: string;
}

interface MenuPosition {
  left: number;
  maxHeight: number;
  top: number;
  width: number;
}

function CountryPicker({
  label,
  hint,
  icon,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  noResults,
}: CountryPickerProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedCountry = COUNTRIES.find((country) => country.value === value);

  const filtered = search
    ? COUNTRIES.filter(
        (c) =>
          c.value.toLowerCase().includes(search.toLowerCase()) ||
          c.vi.toLowerCase().includes(search.toLowerCase())
      )
    : COUNTRIES;

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportPadding = 16;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openUpward = spaceBelow < 260 && spaceAbove > spaceBelow;
    const availableSpace = openUpward ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(180, Math.min(320, availableSpace - 8));

    setMenuPosition({
      left: rect.left,
      maxHeight,
      top: openUpward ? rect.top - maxHeight - 8 : rect.bottom + 8,
      width: rect.width,
    });
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }

      setIsOpen(false);
    }

    if (!isOpen) return;

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (!isOpen) return;

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    document.addEventListener('scroll', updateMenuPosition, true);
    document.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      document.removeEventListener('scroll', updateMenuPosition, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, updateMenuPosition]);

  return (
    <div ref={containerRef} className="relative min-w-0">
      <label className="mb-2 flex items-center gap-2 font-bold text-[#2C2416] text-[13px]">
        {icon}
        {label}
      </label>
      <p className="mb-3 text-[#8B8682] text-[12px] leading-relaxed">{hint}</p>

      {/* Selected display / trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!isOpen) {
            updateMenuPosition();
          }
          setIsOpen((open) => !open);
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/30 ${
          isOpen
            ? 'border-[#C9A87C] bg-white'
            : 'border-[#EAE7E0] bg-[#FDFCF8] hover:border-[#C9A87C]/50'
        }`}
      >
        <span
          className={
            value
              ? 'min-w-0 truncate text-[#2C2416] text-[14px]'
              : 'text-[#8B8682] text-[14px]'
          }
        >
          {value ? `${value} (${selectedCountry?.vi ?? ''})` : placeholder}
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
      {isOpen &&
        menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              left: menuPosition.left,
              top: menuPosition.top,
              width: menuPosition.width,
            }}
            className="fixed z-[140] overflow-hidden rounded-2xl border border-[#EAE7E0] bg-white shadow-[0_20px_60px_rgba(44,36,22,0.18)]"
          >
            <div className="border-[#EAE7E0] border-b p-2">
              <input
                type="text"
                value={search}
                ref={(el) => el?.focus()}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={`Search ${label.toLowerCase()}`}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg bg-[#F5F4F0] px-3 py-2 text-[#2C2416] text-[13px] outline-none placeholder:text-[#8B8682] focus-visible:ring-2 focus-visible:ring-[#C9A87C]/30"
              />
            </div>
            <div
              className="overflow-y-auto p-1"
              style={{ maxHeight: `${menuPosition.maxHeight}px` }}
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-center text-[#8B8682] text-[13px]">
                  {noResults}
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
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors ${
                      value === country.value
                        ? 'bg-[#C9A87C]/10 font-medium text-[#2C2416]'
                        : 'text-[#2C2416] hover:bg-[#F5F4F0]'
                    }`}
                  >
                    <span className="truncate">{country.value}</span>
                    <span className="shrink-0 text-[#8B8682] text-[11px]">
                      {country.vi}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body
        )}
      {isOpen && <div className="h-2" />}
    </div>
  );
}

export function ScreenOrigin({ defaultValues, onChange }: ScreenOriginProps) {
  const t = useTranslations('onboarding');
  const [origin, setOrigin] = useState<string | null>(
    defaultValues.countryOfOrigin
  );
  const [residence, setResidence] = useState<string | null>(
    defaultValues.countryOfResidence
  );
  const [locale, setLocale] = useState<string>(defaultValues.preferredLocale);
  const hasReported = useRef(false);

  const report = useCallback(
    (o: string | null, r: string | null, l: string) => {
      onChange({
        countryOfOrigin: o,
        countryOfResidence: r,
        preferredLocale: l,
      });
    },
    [onChange]
  );

  // Report initial values on mount so wizard knows data is valid
  useEffect(() => {
    if (!hasReported.current) {
      report(origin, residence, locale);
      hasReported.current = true;
    }
  }, [origin, residence, locale, report]);

  return (
    <div className="space-y-6 lg:space-y-7">
      <div className="max-w-2xl">
        <h2
          className="mb-2 font-medium text-2xl text-[#2C2416] tracking-tight"
          style={{ fontFamily: 'Lora, serif' }}
        >
          {t('origin.title')}
        </h2>
        <p
          className="text-[#8B8682] text-[15px] leading-relaxed"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {t('origin.subtitle')}
        </p>
      </div>

      {/* Language preference */}
      <div className="rounded-[24px] border border-[#EAE7E0] bg-white p-5 sm:p-6">
        <label className="mb-3 flex items-center gap-2 font-bold text-[#2C2416] text-[13px]">
          <Languages className="h-4 w-4 text-[#C9A87C]" />
          {t('origin.preferredLanguage')}
        </label>
        <LanguageToggle
          value={locale}
          onChange={(v) => {
            setLocale(v);
            report(origin, residence, v);
          }}
        />
      </div>

      {/* Country pickers */}
      <div className="rounded-[24px] border border-[#EAE7E0] bg-white p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <CountryPicker
            label={t('origin.countryOfOrigin')}
            hint={t('origin.countryOfOriginHint')}
            icon={<Globe className="h-4 w-4 text-[#C9A87C]" />}
            value={origin}
            onChange={(v) => {
              setOrigin(v);
              report(v, residence, locale);
            }}
            placeholder={t('origin.selectCountry')}
            searchPlaceholder={t('origin.searchCountry')}
            noResults={t('origin.noCountries')}
          />

          <CountryPicker
            label={t('origin.countryOfResidence')}
            hint={t('origin.countryOfResidenceHint')}
            icon={<MapPin className="h-4 w-4 text-[#C9A87C]" />}
            value={residence}
            onChange={(v) => {
              setResidence(v);
              report(origin, v, locale);
            }}
            placeholder={t('origin.selectCountry')}
            searchPlaceholder={t('origin.searchCountry')}
            noResults={t('origin.noCountries')}
          />
        </div>

        <p className="mt-5 text-[#8B8682] text-[13px] leading-relaxed">
          {t('origin.fallbackNote')}
        </p>
      </div>
    </div>
  );
}
