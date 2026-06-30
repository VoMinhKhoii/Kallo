'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { DecimalInput } from '@/components/shared/decimal-input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { AGGRESSION_KCAL_PER_KG } from '@/lib/onboarding/constants';
import {
  bodyMetricsMessages,
  bodyMetricsSchema,
  createBodyMetricsSchema,
  goalSchema,
} from '@/lib/onboarding/schemas';
import {
  calcBMR,
  calcDailyTargets,
  calcMacroGrams,
  calcTDEE,
} from '@/lib/onboarding/tdee';
import type { ActivityLevel, CarbSplit, Goal } from '@/lib/onboarding/types';

// Merged schema for screen 1
const screen1Schema = bodyMetricsSchema.merge(goalSchema);
type Screen1FormData = z.infer<typeof screen1Schema>;

export interface ScreenOneData extends Screen1FormData {
  tdeeKcal: number;
  calorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
}

interface ScreenBodyMetricsProps {
  defaultValues: Partial<ScreenOneData>;
  onChange: (data: ScreenOneData) => void;
}

const ACTIVITY_LEVELS: ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'very_active',
];

const ACTIVITY_LEVEL_KEYS: Record<ActivityLevel, string> = {
  sedentary: 'bodyMetrics.sedentary',
  light: 'bodyMetrics.light',
  moderate: 'bodyMetrics.moderate',
  very_active: 'bodyMetrics.veryActive',
};

const GOALS: Goal[] = ['cutting', 'maintaining', 'bulking'];
const CARB_SPLITS: CarbSplit[] = ['moderate_carb', 'lower_carb', 'higher_carb'];

const CARB_SPLIT_KEYS: Record<CarbSplit, string> = {
  moderate_carb: 'bodyMetrics.moderateCarb',
  lower_carb: 'bodyMetrics.lowerCarb',
  higher_carb: 'bodyMetrics.higherCarb',
};

const CARB_SPLIT_DESCS: Record<CarbSplit, string> = {
  moderate_carb: 'bodyMetrics.moderateCarbDescription',
  lower_carb: 'bodyMetrics.lowerCarbDescription',
  higher_carb: 'bodyMetrics.higherCarbDescription',
};

const GOAL_KEYS: Record<Goal, string> = {
  maintaining: 'bodyMetrics.maintaining',
  cutting: 'bodyMetrics.cutting',
  bulking: 'bodyMetrics.bulking',
};

// Custom dropdown matching the Apple Notes aesthetic. Menu is portal-rendered
// with viewport-fixed positioning so it overflows the wizard's overflow-hidden
// modal instead of being clipped at the bottom edge.
function CustomSelect({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: any }[];
  value: any;
  onChange: (v: any) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  // When opening downward we pin the menu's TOP to the trigger's bottom; when
  // opening upward we pin the menu's BOTTOM to the trigger's top so the menu
  // stays glued to the field even when its content is shorter than maxHeight.
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    width: number;
    maxHeight: number;
    anchor: { kind: 'top'; top: number } | { kind: 'bottom'; bottom: number };
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((o) => o.value === value);

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportPadding = 16;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    // Bias toward opening below; flip up only when there is genuinely no
    // room below and meaningfully more above.
    const openUpward = spaceBelow < 160 && spaceAbove > spaceBelow + 40;
    const availableSpace = openUpward ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(160, Math.min(320, availableSpace - 8));
    setMenuPosition({
      left: rect.left,
      width: rect.width,
      maxHeight,
      anchor: openUpward
        ? { kind: 'bottom', bottom: window.innerHeight - rect.top + 6 }
        : { kind: 'top', top: rect.bottom + 6 },
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    // Capture phase so scroll inside the wizard's scrollable content fires.
    document.addEventListener('scroll', updateMenuPosition, true);
    document.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      document.removeEventListener('scroll', updateMenuPosition, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, updateMenuPosition]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!isOpen) updateMenuPosition();
          setIsOpen((open) => !open);
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-[#2C2416] text-[14px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/30 ${
          isOpen
            ? 'border-[#C9A87C] shadow-sm ring-1 ring-[#C9A87C]/20'
            : 'border-[#EAE7E0] hover:border-[#C9A87C]/50'
        }`}
      >
        <span className="truncate pr-2">{selectedOption?.label}</span>
        <ChevronDown
          className={`h-4 w-4 text-[#8B8682] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isOpen && menuPosition && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: -5, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -5, scale: 0.98 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{
                  position: 'fixed',
                  left: menuPosition.left,
                  width: menuPosition.width,
                  maxHeight: menuPosition.maxHeight,
                  zIndex: 140,
                  ...(menuPosition.anchor.kind === 'top'
                    ? { top: menuPosition.anchor.top }
                    : { bottom: menuPosition.anchor.bottom }),
                }}
                className="overflow-y-auto rounded-xl border border-[#EAE7E0] bg-white py-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.08)]"
              >
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[#2C2416] text-[14px] transition-colors hover:bg-[#F5F4F0]"
                  >
                    <span className={value === opt.value ? 'font-medium' : ''}>
                      {opt.label}
                    </span>
                    {value === opt.value && (
                      <Check className="h-4 w-4 text-[#C9A87C]" />
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}

export function ScreenBodyMetrics({
  defaultValues,
  onChange,
}: ScreenBodyMetricsProps) {
  const t = useTranslations('onboarding');
  const tValidation = useTranslations('validation.bodyMetrics');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Built with locale-aware messages so validation errors follow the active
  // locale. Shares the shape of the module-level screen1Schema used for types.
  const localizedSchema = useMemo(
    () =>
      createBodyMetricsSchema(bodyMetricsMessages(tValidation)).merge(
        goalSchema
      ),
    [tValidation]
  );

  const form = useForm<Screen1FormData>({
    resolver: zodResolver(localizedSchema),
    defaultValues: {
      biologicalSex: defaultValues.biologicalSex,
      weightKg: defaultValues.weightKg,
      heightCm: defaultValues.heightCm,
      age: defaultValues.age,
      activityLevel: defaultValues.activityLevel ?? 'light',
      goal: defaultValues.goal ?? 'maintaining',
      aggression: defaultValues.aggression ?? 0.5,
      carbSplit: defaultValues.carbSplit ?? 'moderate_carb',
      deficitOverride: defaultValues.deficitOverride ?? null,
    },
    mode: 'onBlur',
  });

  const values = form.watch();

  // Check if all body metric fields are filled
  const allMetricsFilled = !!(
    values.biologicalSex &&
    values.weightKg &&
    values.heightCm &&
    values.age &&
    values.activityLevel
  );

  // Compute BMR and TDEE
  const bmr = allMetricsFilled
    ? calcBMR({
        biologicalSex: values.biologicalSex,
        weightKg: values.weightKg,
        heightCm: values.heightCm,
        age: values.age,
        activityLevel: values.activityLevel,
      })
    : null;
  const tdee = bmr !== null ? calcTDEE(bmr, values.activityLevel) : null;

  // Reference matrix: compute macros for each goal × carbSplit
  const _matrix = useMemo(() => {
    if (tdee === null) return null;
    const grid: Record<
      string,
      Record<string, ReturnType<typeof calcDailyTargets>>
    > = {};
    for (const g of GOALS) {
      grid[g] = {};
      for (const cs of CARB_SPLITS) {
        grid[g][cs] = calcDailyTargets(tdee, g, 0.5, cs);
      }
    }
    return grid;
  }, [tdee]);

  // Final targets for fine-tuning section
  const finalTargets = useMemo(() => {
    if (tdee === null) return null;
    return calcDailyTargets(
      tdee,
      values.goal,
      values.aggression,
      values.carbSplit,
      values.deficitOverride
    );
  }, [
    tdee,
    values.goal,
    values.aggression,
    values.carbSplit,
    values.deficitOverride,
  ]);

  // Target calories based on goal + aggression
  const targetCalories = finalTargets?.calories ?? 0;

  // Carb split options with computed macros
  const carbOptions = useMemo(
    () =>
      CARB_SPLITS.map((cs) => {
        const macros = calcMacroGrams(targetCalories, cs);
        return {
          id: cs,
          label: t(CARB_SPLIT_KEYS[cs]),
          desc: t(CARB_SPLIT_DESCS[cs]),
          macros,
        };
      }),
    [targetCalories, t]
  );

  // Report data upstream on discrete changes
  const reportChange = useCallback(() => {
    const v = form.getValues();
    if (tdee === null || !finalTargets) return;
    // Don't advance the wizard with out-of-range / invalid metrics — the Next
    // button is gated on this screen having reported data.
    if (!screen1Schema.safeParse(v).success) return;
    onChangeRef.current({
      ...v,
      tdeeKcal: tdee,
      calorieTarget: finalTargets.calories,
      proteinTargetG: finalTargets.proteinG,
      carbsTargetG: finalTargets.carbsG,
      fatTargetG: finalTargets.fatG,
    });
  }, [form, tdee, finalTargets]);

  // Report whenever finalTargets or tdee changes (also covers mount with pre-filled data)
  useEffect(() => {
    if (tdee !== null && finalTargets) {
      reportChange();
    }
  }, [tdee, finalTargets, reportChange]);

  const inputClass =
    'w-full rounded-lg border border-[#EAE7E0] bg-white px-3 py-2 text-[14px] text-[#2C2416] transition-colors hover:border-[#C9A87C]/50 focus-visible:border-[#C9A87C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/20';

  return (
    <Form {...form}>
      <form className="space-y-5 lg:space-y-6">
        <div className="max-w-xl">
          <h2 className="mb-1.5 font-normal font-serif text-2xl text-[#2C2416] tracking-tight">
            {t('bodyMetrics.title')}
          </h2>
          <p className="text-[#8B8682] text-[14px] leading-relaxed">
            {t('bodyMetrics.subtitle')}
          </p>
        </div>

        <div
          className={
            tdee !== null
              ? 'space-y-5 lg:grid lg:grid-cols-[minmax(0,0.98fr)_minmax(0,1.02fr)] lg:items-start lg:gap-5 lg:space-y-0'
              : 'space-y-5'
          }
        >
          <section className="rounded-[28px] border border-[#EAE7E0] bg-white p-5">
            <div className="mb-4">
              <div>
                <p className="font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                  About You
                </p>
                <p className="mt-1 text-[#8B8682] text-[13px] leading-relaxed">
                  These stay optional, but once you fill them in, Nhẩm can
                  compute more tailored targets locally.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="col-span-2 sm:col-span-1">
                <FormField
                  control={form.control}
                  name="biologicalSex"
                  render={({ field }) => (
                    <FormItem>
                      <label className="mb-1.5 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                        {t('bodyMetrics.biologicalSex')}
                      </label>
                      <FormControl>
                        <CustomSelect
                          value={field.value ?? ''}
                          onChange={(v) => {
                            field.onChange(v);
                            reportChange();
                          }}
                          options={[
                            { label: t('bodyMetrics.male'), value: 'male' },
                            { label: t('bodyMetrics.female'), value: 'female' },
                          ]}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="weightKg"
                render={({ field }) => (
                  <FormItem>
                    <label className="mb-1.5 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                      {`${t('bodyMetrics.weight')} (${t('bodyMetrics.weightUnit')})`}
                    </label>
                    <FormControl>
                      <DecimalInput
                        inputMode="decimal"
                        placeholder="65"
                        name={field.name}
                        value={field.value}
                        onValueChange={field.onChange}
                        onBlur={() => {
                          field.onBlur();
                          reportChange();
                        }}
                        className={inputClass}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="heightCm"
                render={({ field }) => (
                  <FormItem>
                    <label className="mb-1.5 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                      {`${t('bodyMetrics.height')} (${t('bodyMetrics.heightUnit')})`}
                    </label>
                    <FormControl>
                      <DecimalInput
                        integer
                        inputMode="numeric"
                        placeholder="170"
                        name={field.name}
                        value={field.value}
                        onValueChange={field.onChange}
                        onBlur={() => {
                          field.onBlur();
                          reportChange();
                        }}
                        className={inputClass}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <label className="mb-1.5 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                      {t('bodyMetrics.age')}
                    </label>
                    <FormControl>
                      <DecimalInput
                        integer
                        inputMode="numeric"
                        placeholder="25"
                        name={field.name}
                        value={field.value}
                        onValueChange={field.onChange}
                        onBlur={() => {
                          field.onBlur();
                          reportChange();
                        }}
                        className={inputClass}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="col-span-2 sm:col-span-4">
                <FormField
                  control={form.control}
                  name="activityLevel"
                  render={({ field }) => (
                    <FormItem>
                      <label className="mb-1.5 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                        {t('bodyMetrics.activityLevel')}
                      </label>
                      <FormControl>
                        <CustomSelect
                          value={field.value ?? ''}
                          onChange={(v) => {
                            field.onChange(v);
                            reportChange();
                          }}
                          options={ACTIVITY_LEVELS.map((level) => ({
                            label: t(ACTIVITY_LEVEL_KEYS[level]),
                            value: level,
                          }))}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </section>

          {tdee !== null ? (
            <section className="space-y-4 rounded-[28px] border border-[#EAE7E0] bg-white p-5">
              <div className="flex flex-col gap-4 border-[#EAE7E0]/80 border-b pb-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <span className="mb-1 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                    {t('bodyMetrics.tdee')}
                  </span>
                  <div className="font-normal font-serif text-4xl text-[#2C2416] tracking-tighter">
                    ~{Math.round(tdee).toLocaleString()}{' '}
                    <span className="font-sans text-[#8B8682] text-lg">
                      {t('bodyMetrics.kcal')}
                    </span>
                  </div>
                </div>

                <div className="w-full xl:w-auto">
                  <label className="mb-2 block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                    {t('bodyMetrics.goal')}
                  </label>
                  <FormField
                    control={form.control}
                    name="goal"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="grid grid-cols-3 rounded-xl bg-[#EAE7E0]/50 p-1">
                            {GOALS.map((g) => (
                              <button
                                key={g}
                                type="button"
                                onClick={() => {
                                  field.onChange(g);
                                  reportChange();
                                }}
                                className={`rounded-lg px-3 py-1.5 font-medium text-[14px] transition-all ${
                                  field.value === g
                                    ? 'bg-white text-[#2C2416] shadow-sm'
                                    : 'text-[#8B8682] hover:text-[#2C2416]'
                                }`}
                              >
                                {t(GOAL_KEYS[g])}
                              </button>
                            ))}
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {values.goal !== 'maintaining' && (
                <FormField
                  control={form.control}
                  name="aggression"
                  render={({ field }) => {
                    const aggressionKg = field.value ?? 0.5;
                    return (
                      <FormItem>
                        <FormControl>
                          <div className="rounded-2xl border border-[#EAE7E0] bg-white p-4">
                            <div className="mb-3 flex items-end justify-between">
                              <label className="block font-bold text-[#2C2416] text-[13px]">
                                {t('bodyMetrics.aggression')}
                              </label>
                              <div className="font-medium text-[#2C2416] text-[14px]">
                                {aggressionKg.toFixed(1)}{' '}
                                <span className="text-[#8B8682]">kg/week</span>
                              </div>
                            </div>
                            <div className="relative px-1">
                              <input
                                type="range"
                                min="0.1"
                                max="0.8"
                                step="0.1"
                                value={aggressionKg}
                                onChange={(e) => {
                                  const v = Number(e.target.value);
                                  field.onChange(v);
                                  reportChange();
                                }}
                                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#EAE7E0] accent-[#2C2416]"
                              />
                              <div className="mt-2.5 flex justify-between text-[#8B8682] text-[11px]">
                                <span
                                  className={
                                    aggressionKg <= 0.3
                                      ? 'font-bold text-[#2C2416]'
                                      : ''
                                  }
                                >
                                  {t('bodyMetrics.aggressionLow')}
                                </span>
                                <span
                                  className={
                                    aggressionKg > 0.3 && aggressionKg <= 0.6
                                      ? 'font-bold text-[#2C2416]'
                                      : ''
                                  }
                                >
                                  Moderate
                                </span>
                                <span
                                  className={
                                    aggressionKg > 0.6
                                      ? 'font-bold text-[#2C2416]'
                                      : ''
                                  }
                                >
                                  {t('bodyMetrics.aggressionHigh')}
                                </span>
                              </div>
                            </div>
                            <div className="mt-3 rounded-lg bg-[#F5F4F0] px-3 py-2 text-center text-[#A8A29E] text-[12px]">
                              Translates to a{' '}
                              <span className="font-medium text-[#2C2416]">
                                ~
                                {Math.round(
                                  aggressionKg * AGGRESSION_KCAL_PER_KG
                                )}{' '}
                                kcal/day
                              </span>{' '}
                              {values.goal === 'cutting'
                                ? 'deficit'
                                : 'surplus'}
                              .
                            </div>
                          </div>
                        </FormControl>
                      </FormItem>
                    );
                  }}
                />
              )}

              {targetCalories > 0 && (
                <div>
                  <div className="mb-3 flex items-baseline justify-between">
                    <label className="block font-bold text-[#A8A29E] text-[11px] uppercase tracking-widest">
                      {t('bodyMetrics.macroSummary')}
                    </label>
                    <div className="font-normal font-serif text-2xl text-[#2C2416]">
                      {targetCalories}{' '}
                      <span className="font-sans text-[#8B8682] text-sm">
                        {t('bodyMetrics.kcal')}
                      </span>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="carbSplit"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="grid gap-2.5 lg:grid-cols-3">
                            {carbOptions.map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  field.onChange(opt.id);
                                  reportChange();
                                }}
                                className={`overflow-hidden rounded-[22px] border text-left transition-all ${
                                  field.value === opt.id
                                    ? 'border-[#C9A87C] bg-[#FFF8EF] shadow-[0_10px_24px_rgba(201,168,124,0.14)]'
                                    : 'border-[#EAE7E0] bg-white hover:border-[#C9A87C]/50'
                                }`}
                              >
                                <div
                                  className={`px-3.5 py-2.5 ${
                                    field.value === opt.id
                                      ? 'bg-[#FBF2E6] text-[#2C2416]'
                                      : 'bg-[#F5F4F0] text-[#2C2416]'
                                  }`}
                                >
                                  <div className="font-medium text-[13px]">
                                    {opt.label}
                                  </div>
                                  <div
                                    className={`mt-0.5 text-[10px] ${
                                      field.value === opt.id
                                        ? 'text-[#6F6556]'
                                        : 'text-[#8B8682]'
                                    }`}
                                  >
                                    {opt.desc}
                                  </div>
                                </div>
                                <div className="px-3.5 py-3">
                                  <div className="space-y-1.5 text-[11px]">
                                    {[
                                      {
                                        label: t('bodyMetrics.protein'),
                                        value: opt.macros.proteinG,
                                      },
                                      {
                                        label: t('bodyMetrics.fat'),
                                        value: opt.macros.fatG,
                                      },
                                      {
                                        label: t('bodyMetrics.carbs'),
                                        value: opt.macros.carbsG,
                                      },
                                    ].map((macro) => (
                                      <div
                                        key={macro.label}
                                        className="flex items-center justify-between gap-3"
                                      >
                                        <span className="text-[#6F6556] text-[10px] uppercase tracking-wide">
                                          {macro.label}
                                        </span>
                                        <span className="font-semibold text-[#2C2416] text-[12px]">
                                          {macro.value}
                                          {t('bodyMetrics.grams')}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </section>
          ) : (
            <div className="rounded-[28px] border border-[#EAE7E0] border-dashed bg-[#FFFCF8] p-5">
              <p className="font-medium text-[#2C2416] text-[14px]">
                Fill the basics to unlock targets.
              </p>
              <p className="mt-1 text-[#8B8682] text-[13px] leading-relaxed">
                Once sex, weight, height, age, and activity are filled, this
                side turns into your live calorie target and macro planner.
              </p>
            </div>
          )}
        </div>
      </form>
    </Form>
  );
}
