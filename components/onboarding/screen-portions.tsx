'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Ruler } from 'lucide-react';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { portionCalibrationSchema } from '@/lib/onboarding/schemas';

// Explicit form type to avoid .default() making fields optional
interface PortionFormData {
  handSpanCm: number | null;
  knuckleDepthCm: number | null;
  bowlSizeMl: number;
  plateSizeMl: number;
}

interface ScreenPortionsProps {
  defaultValues: {
    handSpanCm: number | null;
    knuckleDepthCm: number | null;
    bowlSizeMl: number;
    plateSizeMl: number;
  };
  onChange: (data: {
    handSpanCm: number | null;
    knuckleDepthCm: number | null;
    bowlSizeMl: number;
    plateSizeMl: number;
  }) => void;
  onSkip: () => void;
}

export function ScreenPortions({
  defaultValues,
  onChange,
  onSkip,
}: ScreenPortionsProps) {
  const form = useForm<PortionFormData>({
    resolver: zodResolver(portionCalibrationSchema) as any,
    defaultValues: {
      handSpanCm: defaultValues.handSpanCm ?? undefined,
      knuckleDepthCm: defaultValues.knuckleDepthCm ?? undefined,
      bowlSizeMl: defaultValues.bowlSizeMl,
      plateSizeMl: defaultValues.plateSizeMl,
    },
    mode: 'onBlur',
  });

  const reportChange = useCallback(() => {
    const v = form.getValues();
    onChange({
      handSpanCm: v.handSpanCm ?? null,
      knuckleDepthCm: v.knuckleDepthCm ?? null,
      bowlSizeMl: v.bowlSizeMl,
      plateSizeMl: v.plateSizeMl,
    });
  }, [form, onChange]);

  return (
    <Form {...form}>
      <form className="space-y-8">
        <div>
          <h2
            className="mb-2 font-medium text-2xl text-[#2C2416] tracking-tight"
            style={{ fontFamily: 'Lora, serif' }}
          >
            Personal Portion Calibration
          </h2>
          <p className="text-[#8B8682] text-[15px] leading-relaxed">
            <span className="mb-2 block italic">
              &ldquo;Gang tay và đốt ngón của bạn to cỡ nào?&rdquo;
            </span>
            AI uses these measurements to calculate highly accurate gram
            estimates when you describe food as &ldquo;nửa gang cá&rdquo; or
            &ldquo;thịt dày một đốt ngón&rdquo; in natural language.
          </p>
        </div>

        {/* Split card: icon left + inputs right */}
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
                    Hand span / Gang tay
                  </label>
                  <FormControl>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 21"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          field.onChange(v === '' ? undefined : Number(v));
                        }}
                        onBlur={() => {
                          field.onBlur();
                          reportChange();
                        }}
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
                    Index knuckle / Đốt ngón trỏ
                  </label>
                  <FormControl>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 2.5"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          field.onChange(v === '' ? undefined : Number(v));
                        }}
                        onBlur={() => {
                          field.onBlur();
                          reportChange();
                        }}
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

        {/* Bowl & Plate size row */}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="bowlSizeMl"
            render={({ field }) => (
              <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-5">
                <label className="mb-2 block font-bold text-[#2C2416] text-[13px]">
                  Default bowl size
                </label>
                <FormControl>
                  <div className="relative">
                    <input
                      type="number"
                      min="50"
                      max="1000"
                      placeholder="300"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        field.onChange(v === '' ? undefined : Number(v));
                      }}
                      onBlur={() => {
                        field.onBlur();
                        reportChange();
                      }}
                      className="w-full rounded-xl border border-[#EAE7E0] bg-[#FDFCF8] px-4 py-3 pr-12 text-[#2C2416] outline-none focus:border-[#C9A87C]"
                    />
                    <span className="absolute top-1/2 right-4 -translate-y-1/2 font-medium text-[#8B8682] text-[13px]">
                      ml
                    </span>
                  </div>
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="plateSizeMl"
            render={({ field }) => (
              <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-5">
                <label className="mb-2 block font-bold text-[#2C2416] text-[13px]">
                  Default plate/bowl size
                </label>
                <FormControl>
                  <div className="relative">
                    <input
                      type="number"
                      min="100"
                      max="2000"
                      placeholder="600"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        field.onChange(v === '' ? undefined : Number(v));
                      }}
                      onBlur={() => {
                        field.onBlur();
                        reportChange();
                      }}
                      className="w-full rounded-xl border border-[#EAE7E0] bg-[#FDFCF8] px-4 py-3 pr-12 text-[#2C2416] outline-none focus:border-[#C9A87C]"
                    />
                    <span className="absolute top-1/2 right-4 -translate-y-1/2 font-medium text-[#8B8682] text-[13px]">
                      ml
                    </span>
                  </div>
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {/* Dual CTA buttons */}
        <div className="flex flex-col gap-3 pt-4">
          <button
            type="button"
            onClick={() => {
              form.handleSubmit(
                () => reportChange(),
                () => {}
              )();
            }}
            className="w-full rounded-xl bg-[#2C2416] py-3.5 font-medium text-[#FDFCF8] text-[15px] shadow-sm transition-colors hover:bg-[#1C1917]"
          >
            Đo ngay (1 phút)
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="w-full py-3 font-medium text-[#8B8682] text-[14px] transition-colors hover:text-[#2C2416]"
          >
            Bỏ qua, dùng mặc định
          </button>
        </div>
      </form>
    </Form>
  );
}
