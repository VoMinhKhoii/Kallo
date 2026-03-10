'use client';

import { Ruler } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import type { ProfileFormValues } from './index';

export function Portions() {
  const form = useFormContext<ProfileFormValues>();

  return (
    <div className="space-y-6">
      <p className="text-[#8B8682] text-[14px] leading-relaxed">
        AI uses these measurements to calculate accurate gram estimates when you
        describe food portions relative to your hand. Leave blank to use
        defaults.
      </p>

      <div className="flex flex-col items-center gap-8 rounded-2xl border border-[#EAE7E0] bg-white p-6 sm:p-8 md:flex-row">
        {/* Visual reference */}
        <div className="flex w-full items-center justify-center md:w-1/2">
          <div className="relative flex h-40 w-40 items-center justify-center rounded-full border border-[#EAE7E0] border-dashed bg-[#F5F4F0]">
            <Ruler className="h-12 w-12 text-[#C9A87C] opacity-50" />
            <div className="absolute -bottom-4 rounded-full border border-[#EAE7E0] bg-white px-3 py-1 font-bold text-[#8B8682] text-[10px] uppercase tracking-widest shadow-sm">
              Use a ruler
            </div>
          </div>
        </div>

        {/* Hand measurement inputs */}
        <div className="w-full space-y-6 md:w-1/2">
          <FormField
            control={form.control}
            name="handSpanCm"
            render={({ field }) => (
              <FormItem>
                <label className="mb-2 block font-bold text-[#2C2416] text-[13px]">
                  Hand span
                </label>
                <FormControl>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 21"
                      value={field.value ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        field.onChange(v === '' ? null : Number(v));
                      }}
                      onBlur={field.onBlur}
                      className="w-full rounded-xl border border-[#EAE7E0] bg-[#FDFCF8] px-4 py-3 pr-12 text-[#2C2416] outline-none focus:border-[#C9A87C]"
                    />
                    <span className="absolute top-1/2 right-4 -translate-y-1/2 font-medium text-[#8B8682] text-[13px]">
                      cm
                    </span>
                  </div>
                </FormControl>
                <p className="mt-1.5 text-[#8B8682] text-[11px]">
                  Tip of thumb to tip of pinky when stretched.
                </p>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="knuckleDepthCm"
            render={({ field }) => (
              <FormItem>
                <label className="mb-2 block font-bold text-[#2C2416] text-[13px]">
                  Index knuckle depth
                </label>
                <FormControl>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 2.5"
                      value={field.value ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        field.onChange(v === '' ? null : Number(v));
                      }}
                      onBlur={field.onBlur}
                      className="w-full rounded-xl border border-[#EAE7E0] bg-[#FDFCF8] px-4 py-3 pr-12 text-[#2C2416] outline-none focus:border-[#C9A87C]"
                    />
                    <span className="absolute top-1/2 right-4 -translate-y-1/2 font-medium text-[#8B8682] text-[13px]">
                      cm
                    </span>
                  </div>
                </FormControl>
                <p className="mt-1.5 text-[#8B8682] text-[11px]">
                  Depth/thickness of your top index finger knuckle.
                </p>
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  );
}
