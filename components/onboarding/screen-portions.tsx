'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
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
        {/* Section 1: Hand Measurements */}
        <div className="space-y-4">
          <div>
            <h2
              className="font-semibold text-[#2C2416] text-lg"
              style={{ fontFamily: 'Lora, serif' }}
            >
              Hiệu chỉnh phần ăn
            </h2>
            <p
              className="mt-1.5 text-[#6B5D4F] text-sm"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              Đo bàn tay giúp AI ước lượng phần ăn chính xác hơn khi bạn mô tả
              "bằng nắm tay" hay "bằng lòng bàn tay".
            </p>
          </div>

          <div className="rounded-xl border border-[#E8D5B5]/50 bg-[#FEFBF6] p-5">
            <div className="space-y-4">
              {/* Hand Span */}
              <FormField
                control={form.control}
                name="handSpanCm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium text-[#2C2416] text-sm">
                      Sải tay (hand span)
                    </FormLabel>
                    <p className="text-[#8B7355] text-xs">
                      Đo từ đầu ngón cái đến đầu ngón út khi xòe tay
                    </p>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="20"
                          step="0.5"
                          min={10}
                          max={35}
                          className="w-24"
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const val =
                              e.target.value === ''
                                ? null
                                : Number(e.target.value);
                            field.onChange(val);
                          }}
                          onBlur={() => {
                            field.onBlur();
                            reportChange();
                          }}
                        />
                        <span className="text-[#B0A695] text-sm">cm</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Knuckle Depth */}
              <FormField
                control={form.control}
                name="knuckleDepthCm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium text-[#2C2416] text-sm">
                      Độ sâu đốt ngón (knuckle depth)
                    </FormLabel>
                    <p className="text-[#8B7355] text-xs">
                      Đo chiều cao đốt ngón trỏ
                    </p>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="2.5"
                          step="0.1"
                          min={1}
                          max={5}
                          className="w-24"
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const val =
                              e.target.value === ''
                                ? null
                                : Number(e.target.value);
                            field.onChange(val);
                          }}
                          onBlur={() => {
                            field.onBlur();
                            reportChange();
                          }}
                        />
                        <span className="text-[#B0A695] text-sm">cm</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[#E8D5B5]/30 bg-[#E8D5B5]/5 p-5">
          <div className="space-y-4">
            <div>
              <h3
                className="font-medium text-[#2C2416] text-base"
                style={{ fontFamily: 'Lora, serif' }}
              >
                Bát đĩa
              </h3>
              <p
                className="mt-1 text-[#8B7355] text-xs"
                style={{ fontFamily: 'DM Sans, sans-serif' }}
              >
                Giá trị mặc định phù hợp đa số người Việt
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Bowl Size */}
              <FormField
                control={form.control}
                name="bowlSizeMl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium text-[#2C2416] text-sm">
                      Kích thước bát (ml)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={50}
                        max={1000}
                        className="w-full"
                        value={field.value ?? ''}
                        onChange={(e) => {
                          field.onChange(Number(e.target.value));
                        }}
                        onBlur={() => {
                          field.onBlur();
                          reportChange();
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Plate Size */}
              <FormField
                control={form.control}
                name="plateSizeMl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium text-[#2C2416] text-sm">
                      Kích thước đĩa (ml)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={100}
                        max={2000}
                        className="w-full"
                        value={field.value ?? ''}
                        onChange={(e) => {
                          field.onChange(Number(e.target.value));
                        }}
                        onBlur={() => {
                          field.onBlur();
                          reportChange();
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
