'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import { type FieldErrors, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Form } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { saveProfileSettings } from '@/lib/onboarding/actions';
import {
  bodyMetricsMessages,
  cookingHabitsSchema,
  countrySchema,
  createBodyMetricsSchema,
} from '@/lib/onboarding/schemas';
import {
  calcBMR,
  calcDailyTargets,
  calcMacroGrams,
  calcTDEE,
} from '@/lib/onboarding/tdee';
import type {
  ActivityLevel,
  BrothConsumption,
  CarbSplit,
  Goal,
  OilUsage,
  ProteinPortion,
  RicePortion,
  SugarBraised,
} from '@/lib/onboarding/types';
import { BodyMetrics } from './body-metrics';
import { Cooking } from './cooking';
import { Regional } from './regional';

const profileGoalSchema = z.object({
  goal: z.enum(['cutting', 'bulking', 'maintaining']),
  aggression: z.number().min(0.1).max(0.8).nullable(),
  carbSplit: z.enum(['moderate_carb', 'lower_carb', 'higher_carb']),
});

export type ProfileFormValues = z.infer<
  ReturnType<typeof createBodyMetricsSchema>
> &
  z.infer<typeof profileGoalSchema> &
  z.infer<typeof countrySchema> &
  z.infer<typeof cookingHabitsSchema>;

type SectionId = 'body-metrics' | 'regional' | 'cooking';

// Which tab owns each field, so an invalid submit can switch to the tab
// holding the first error instead of failing silently behind another tab.
const SECTION_FOR_FIELD: Partial<Record<keyof ProfileFormValues, SectionId>> = {
  biologicalSex: 'body-metrics',
  weightKg: 'body-metrics',
  heightCm: 'body-metrics',
  age: 'body-metrics',
  activityLevel: 'body-metrics',
  goal: 'body-metrics',
  aggression: 'body-metrics',
  carbSplit: 'body-metrics',
  countryOfOrigin: 'regional',
  countryOfResidence: 'regional',
  oilUsage: 'cooking',
  defaultRicePortion: 'cooking',
  sugarBraised: 'cooking',
  defaultProteinPortion: 'cooking',
  brothConsumption: 'cooking',
};

interface Section {
  id: SectionId;
  title: string;
  subtitle: string;
}

interface ProfileProps {
  profile: {
    weightKg: string | null;
    heightCm: number | null;
    age: number | null;
    biologicalSex: string | null;
    activityLevel: string | null;
    tdeeKcal: number | null;
    goal: string | null;
    aggression: string | null;
    carbSplit: string | null;
    calorieTarget: number | null;
    proteinTargetG: number | null;
    carbsTargetG: number | null;
    fatTargetG: number | null;
    countryOfOrigin: string | null;
    countryOfResidence: string | null;
    oilUsage: string | null;
    defaultRicePortion: string | null;
    sugarBraised: string | null;
    defaultProteinPortion: string | null;
    brothConsumption: string | null;
  };
}

export function Profile({ profile }: ProfileProps) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const tValidation = useTranslations('validation.bodyMetrics');
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<SectionId>('body-metrics');

  const SECTIONS: Section[] = [
    {
      id: 'body-metrics',
      title: t('bodyMetrics'),
      subtitle: t('profilePanel.bodyMetricsSubtitle'),
    },
    {
      id: 'regional',
      title: t('regional'),
      subtitle: t('profilePanel.regionalSubtitle'),
    },
    {
      id: 'cooking',
      title: t('cooking'),
      subtitle: t('profilePanel.cookingSubtitle'),
    },
  ];

  const defaultValues: ProfileFormValues = useMemo(
    () => ({
      // Body metrics are NOT defaulted to fabricated numbers. A user who
      // skipped onboarding has null weight/height/age/sex; pre-filling
      // 65kg/165cm/25y/male would let them save fabricated data as if it were
      // real (and silently recompute a target from it). Leave them empty so
      // the schema's "required" validation forces a real entry before save.
      biologicalSex:
        (profile.biologicalSex as 'male' | 'female') ??
        (undefined as unknown as 'male' | 'female'),
      weightKg: profile.weightKg
        ? Number(profile.weightKg)
        : (undefined as unknown as number),
      heightCm: profile.heightCm ?? (undefined as unknown as number),
      age: profile.age ?? (undefined as unknown as number),
      activityLevel:
        (profile.activityLevel as ActivityLevel) ??
        (undefined as unknown as ActivityLevel),
      goal: (profile.goal as Goal) ?? 'maintaining',
      aggression: (() => {
        const raw = profile.aggression;
        if (!raw) return null;
        const n = Number(raw);
        return Number.isNaN(n) ? 0.5 : n;
      })(),
      carbSplit: (profile.carbSplit as CarbSplit) ?? 'moderate_carb',
      countryOfOrigin: profile.countryOfOrigin ?? null,
      countryOfResidence: profile.countryOfResidence ?? null,
      oilUsage: (profile.oilUsage as OilUsage) ?? 'normal',
      defaultRicePortion:
        (profile.defaultRicePortion as RicePortion) ?? 'medium',
      sugarBraised: (profile.sugarBraised as SugarBraised) ?? 'medium',
      defaultProteinPortion:
        (profile.defaultProteinPortion as ProteinPortion) ?? 'medium',
      brothConsumption:
        (profile.brothConsumption as BrothConsumption) ?? 'some',
    }),
    [profile]
  );

  // Built with locale-aware messages so validation errors follow the active
  // locale. Shares the shape of the type-level ProfileFormValues above.
  const localizedProfileSchema = useMemo(
    () =>
      createBodyMetricsSchema(bodyMetricsMessages(tValidation))
        .merge(profileGoalSchema)
        .merge(countrySchema)
        .merge(cookingHabitsSchema),
    [tValidation]
  );

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(localizedProfileSchema),
    defaultValues,
    mode: 'onBlur',
  });

  const isDirty = form.formState.isDirty;

  function handleCancel() {
    form.reset(defaultValues);
  }

  function handleInvalid(errors: FieldErrors<ProfileFormValues>) {
    const firstField = Object.keys(errors)[0] as
      | keyof ProfileFormValues
      | undefined;
    const section = firstField ? SECTION_FOR_FIELD[firstField] : undefined;
    if (section) {
      setActiveTab(section);
    }
    toast.error(t('profilePanel.invalidError'));
  }

  function handleSave(values: ProfileFormValues) {
    // Compute TDEE and macros for persistence
    const bmr = calcBMR({
      biologicalSex: values.biologicalSex,
      weightKg: values.weightKg,
      heightCm: values.heightCm,
      age: values.age,
      activityLevel: values.activityLevel,
    });
    const tdee = calcTDEE(bmr, values.activityLevel);
    const targets = calcDailyTargets(
      tdee,
      values.goal,
      values.aggression,
      values.carbSplit
    );
    const macros = calcMacroGrams(
      Math.max(targets.calories, 500),
      values.carbSplit
    );

    startTransition(async () => {
      try {
        await saveProfileSettings({
          weightKg: values.weightKg,
          heightCm: values.heightCm,
          age: values.age,
          biologicalSex: values.biologicalSex,
          activityLevel: values.activityLevel,
          tdeeKcal: tdee,
          goal: values.goal,
          aggression: values.aggression,
          carbSplit: values.carbSplit,
          calorieTarget: Math.max(targets.calories, 500),
          proteinTargetG: macros.proteinG,
          carbsTargetG: macros.carbsG,
          fatTargetG: macros.fatG,
          countryOfOrigin: values.countryOfOrigin,
          countryOfResidence: values.countryOfResidence,
          preferredLocale: locale,
          oilUsage: values.oilUsage,
          defaultRicePortion: values.defaultRicePortion,
          sugarBraised: values.sugarBraised,
          defaultProteinPortion: values.defaultProteinPortion,
          brothConsumption: values.brothConsumption,
        });
        form.reset(values);
        toast.success(t('saved'));
      } catch {
        toast.error(t('profilePanel.saveError'));
      }
    });
  }

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSave, handleInvalid)}
          className="space-y-3"
        >
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as SectionId)}
            className="w-full gap-0"
          >
            <TabsList className="mb-2 h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-[#EAE7E0]/40 p-1">
              {SECTIONS.map((section) => (
                <TabsTrigger
                  key={section.id}
                  value={section.id}
                  className="flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 font-medium text-[#7B6F62] text-[14px] focus-visible:ring-2 focus-visible:ring-[#C9A87C]/40 data-[state=active]:bg-white data-[state=active]:text-[#2C2416] data-[state=active]:shadow-sm"
                >
                  {section.title}
                </TabsTrigger>
              ))}
            </TabsList>

            {SECTIONS.map((section) => (
              <TabsContent
                key={section.id}
                value={section.id}
                className="rounded-2xl border border-[#EAE7E0] bg-[#FDFCF8] p-3 focus-visible:outline-none sm:p-5 lg:p-6"
              >
                <p className="mb-5 text-[#7B6F62] text-[13px] sm:mb-6">
                  {section.subtitle}
                </p>
                {section.id === 'body-metrics' && <BodyMetrics />}
                {section.id === 'regional' && <Regional />}
                {section.id === 'cooking' && <Cooking />}
              </TabsContent>
            ))}
          </Tabs>

          {/* Pinned save bar — rests above the bottom edge while content
              scrolls behind it and dissolves into a soft fade. */}
          <AnimatePresence>
            {isDirty && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="sticky inset-x-0 bottom-0 z-20 pb-3 sm:pb-4"
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 -top-8 bottom-0 bg-gradient-to-t from-55% from-nham-surface to-transparent"
                />
                <div className="relative flex items-center justify-end gap-3 rounded-2xl border border-[#EAE7E0] bg-[#FDFCF8]/95 px-5 py-3.5 shadow-lg backdrop-blur-sm sm:px-6 sm:py-4">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isPending}
                    className="rounded-xl px-5 py-2.5 font-medium text-[#7B6F62] text-[14px] transition-colors hover:bg-[#F5F4F0] hover:text-[#2C2416] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/40"
                  >
                    {tc('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex items-center gap-2 rounded-xl bg-[#2C2416] px-5 py-2.5 font-medium text-[#FDFCF8] text-[14px] shadow-sm transition-all hover:bg-[#1C1917] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/60 disabled:opacity-50"
                  >
                    {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t('save')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </Form>
    </div>
  );
}
