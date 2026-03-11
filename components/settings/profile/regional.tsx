'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import type { RegionalProfile } from '@/lib/onboarding/types';
import type { ProfileFormValues } from './index';

const REGION_CARDS: {
  value: RegionalProfile;
  title: string;
  quote: string;
  detail: string;
}[] = [
  {
    value: 'mien_bac',
    title: 'Northern',
    quote: 'Light, balanced flavors.',
    detail:
      'Less oil, less sugar — AI defaults to gentle seasoning, preserving the natural taste of ingredients.',
  },
  {
    value: 'mien_trung',
    title: 'Central',
    quote: 'Bold, full-bodied.',
    detail:
      'Rich spices, distinctive fish sauce — AI defaults to saltier, more intensely seasoned and concentrated portions.',
  },
  {
    value: 'mien_nam',
    title: 'Southern',
    quote: 'Mildly sweet, diverse.',
    detail:
      'A gentle sweetness in most dishes — AI automatically adds small amounts of sugar to braised and stir-fried dishes.',
  },
  {
    value: 'mien_tay',
    title: 'Mekong Delta',
    quote: 'Rich, deeply sweet.',
    detail:
      'Coconut milk and sugar are the soul — AI defaults to higher fat and carb levels for braised, soup, and stir-fried dishes.',
  },
];

export function Regional() {
  const form = useFormContext<ProfileFormValues>();
  const selected = useWatch({ name: 'regionalProfile' });

  return (
    <div className="space-y-4">
      <p
        className="text-[#8B8682] text-[14px] leading-relaxed"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        AI uses this to infer default seasoning, oil usage, and portion styles
        when details are missing.
      </p>

      <FormField
        control={form.control}
        name="regionalProfile"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <div className="grid gap-4 sm:grid-cols-2">
                {REGION_CARDS.map((region) => {
                  const isSelected = selected === region.value;
                  return (
                    <button
                      key={region.value}
                      type="button"
                      onClick={() => field.onChange(region.value)}
                      className={`flex flex-col gap-2 rounded-2xl border p-5 text-left transition-all ${
                        isSelected
                          ? 'border-[#C9A87C] bg-[#C9A87C]/5 shadow-sm'
                          : 'border-[#EAE7E0] bg-white hover:border-[#C9A87C]/50'
                      }`}
                    >
                      <h3 className="font-medium text-[#2C2416] text-[16px]">
                        {region.title}
                      </h3>
                      <p
                        className="font-medium text-[#8B8682] text-[13px] italic"
                        style={{ fontFamily: 'Lora, serif' }}
                      >
                        &ldquo;{region.quote}&rdquo;
                      </p>
                      <p className="text-[#8B8682] text-[13px] leading-relaxed">
                        {region.detail}
                      </p>
                    </button>
                  );
                })}
              </div>
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}
