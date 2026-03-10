'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Form } from '@/components/ui/form';
import { saveProfileSettings } from '@/lib/onboarding/actions';
import {
  bodyMetricsSchema,
  cookingHabitsSchema,
  portionCalibrationSchema,
  regionalSchema,
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
  RegionalProfile,
  RicePortion,
  SugarBraised,
} from '@/lib/onboarding/types';
import { BodyMetrics } from './body-metrics';
import { Cooking } from './cooking';
import { Portions } from './portions';
import { Regional } from './regional';

const profileSchema = bodyMetricsSchema
  .merge(
    z.object({
      goal: z.enum(['cutting', 'bulking', 'maintaining']),
      aggression: z.number().min(0.1).max(0.8).nullable(),
      carbSplit: z.enum(['moderate_carb', 'lower_carb', 'higher_carb']),
    })
  )
  .merge(regionalSchema)
  .merge(cookingHabitsSchema)
  .merge(portionCalibrationSchema);

export type ProfileFormValues = z.infer<typeof profileSchema>;

type SectionId = 'body-metrics' | 'regional' | 'cooking' | 'portions';

interface Section {
  id: SectionId;
  title: string;
  subtitle: string;
}

const SECTIONS: Section[] = [
  {
    id: 'body-metrics',
    title: 'Body Metrics & Goals',
    subtitle: 'Weight, height, activity level, and macro targets',
  },
  {
    id: 'regional',
    title: 'Regional Profile',
    subtitle: 'Vietnamese cooking region for default seasonings',
  },
  {
    id: 'cooking',
    title: 'Cooking Habits',
    subtitle: 'Oil usage, rice, sugar, protein, and broth defaults',
  },
  {
    id: 'portions',
    title: 'Portion Calibration',
    subtitle: 'Hand measurements for accurate gram estimates',
  },
];

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
    regionalProfile: string | null;
    oilUsage: string | null;
    defaultRicePortion: string | null;
    sugarBraised: string | null;
    defaultProteinPortion: string | null;
    brothConsumption: string | null;
    handSpanCm: string | null;
    knuckleDepthCm: string | null;
  };
}

export function Profile({ profile }: ProfileProps) {
  const [openSection, setOpenSection] = useState<SectionId>('body-metrics');
  const [isPending, startTransition] = useTransition();

  const defaultValues: ProfileFormValues = useMemo(
    () => ({
      biologicalSex: (profile.biologicalSex as 'male' | 'female') ?? 'male',
      weightKg: profile.weightKg ? Number(profile.weightKg) : 65,
      heightCm: profile.heightCm ?? 165,
      age: profile.age ?? 25,
      activityLevel: (profile.activityLevel as ActivityLevel) ?? 'light',
      goal: (profile.goal as Goal) ?? 'maintaining',
      aggression: (() => {
        const raw = profile.aggression;
        if (!raw) return null;
        const n = Number(raw);
        return Number.isNaN(n) ? 0.5 : n;
      })(),
      carbSplit: (profile.carbSplit as CarbSplit) ?? 'moderate_carb',
      regionalProfile:
        (profile.regionalProfile as RegionalProfile) ?? 'mien_bac',
      oilUsage: (profile.oilUsage as OilUsage) ?? 'normal',
      defaultRicePortion:
        (profile.defaultRicePortion as RicePortion) ?? 'medium',
      sugarBraised: (profile.sugarBraised as SugarBraised) ?? 'medium',
      defaultProteinPortion:
        (profile.defaultProteinPortion as ProteinPortion) ?? 'medium',
      brothConsumption:
        (profile.brothConsumption as BrothConsumption) ?? 'some',
      handSpanCm: profile.handSpanCm ? Number(profile.handSpanCm) : null,
      knuckleDepthCm: profile.knuckleDepthCm
        ? Number(profile.knuckleDepthCm)
        : null,
    }),
    [profile]
  );

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues,
    mode: 'onBlur',
  });

  const isDirty = form.formState.isDirty;

  function toggleSection(id: SectionId) {
    setOpenSection((prev) => (prev === id ? prev : id));
  }

  function handleCancel() {
    form.reset(defaultValues);
  }

  function handleSave() {
    const values = form.getValues();

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
          regionalProfile: values.regionalProfile,
          oilUsage: values.oilUsage,
          defaultRicePortion: values.defaultRicePortion,
          sugarBraised: values.sugarBraised,
          defaultProteinPortion: values.defaultProteinPortion,
          brothConsumption: values.brothConsumption,
          handSpanCm: values.handSpanCm,
          knuckleDepthCm: values.knuckleDepthCm,
        });
        form.reset(values);
        toast.success('Profile settings saved');
      } catch {
        toast.error('Failed to save settings. Please try again.');
      }
    });
  }

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>
      <Form {...form}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-3"
        >
          {SECTIONS.map((section) => {
            const isOpen = openSection === section.id;
            return (
              <div
                key={section.id}
                className="overflow-hidden rounded-2xl border border-[#EAE7E0] bg-[#FDFCF8] transition-shadow hover:shadow-sm"
              >
                {/* Accordion header */}
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="flex w-full items-center justify-between px-6 py-4 text-left"
                >
                  <div>
                    <h3
                      className="font-medium text-[#2C2416] text-[16px] tracking-tight"
                      style={{ fontFamily: 'Lora, serif' }}
                    >
                      {section.title}
                    </h3>
                    <p className="mt-0.5 text-[#8B8682] text-[13px]">
                      {section.subtitle}
                    </p>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-[#8B8682] transition-transform duration-300 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Accordion content */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        height: { duration: 0.3, ease: 'easeInOut' },
                        opacity: { duration: 0.2 },
                      }}
                      className="overflow-hidden"
                    >
                      <div className="border-[#EAE7E0] border-t px-6 py-6">
                        {section.id === 'body-metrics' && <BodyMetrics />}
                        {section.id === 'regional' && <Regional />}
                        {section.id === 'cooking' && <Cooking />}
                        {section.id === 'portions' && <Portions />}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* Sticky Save/Cancel bar */}
          <AnimatePresence>
            {isDirty && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="sticky bottom-0 z-10 flex items-center justify-end gap-3 rounded-2xl border border-[#EAE7E0] bg-[#FDFCF8]/95 px-6 py-4 shadow-lg backdrop-blur-sm"
              >
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isPending}
                  className="rounded-xl px-5 py-2.5 font-medium text-[#8B8682] text-[14px] transition-colors hover:bg-[#F5F4F0] hover:text-[#2C2416]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-2 rounded-xl bg-[#2C2416] px-5 py-2.5 font-medium text-[#FDFCF8] text-[14px] shadow-sm transition-all hover:bg-[#1C1917] disabled:opacity-50"
                >
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Changes
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </Form>
    </div>
  );
}
