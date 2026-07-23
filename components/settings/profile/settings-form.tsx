'use client';

import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';
import {
  PREFERENCES_ANCHOR,
  PROFILE_ANCHOR,
  SUBSECTION_ANCHOR,
} from '@/components/settings/anchors';
import { SettingsGroup } from '@/components/settings/group';
import { IdentityRows } from '@/components/settings/identity/identity-rows';
import { SectionHeader } from '@/components/settings/section-header';
import { Form } from '@/components/ui/form';
import { CookingRows } from './cooking-rows';
import type { ProfileFormValues, ProfileInput } from './form-schema';
import { GoalFields } from './goal-fields';
import { MetricsFields } from './metrics-fields';
import { RegionalRows } from './regional-rows';
import { SaveBar } from './save-bar';
import { TargetHero } from './target-hero';
import { useLiveTargets } from './use-live-targets';
import { useProfileForm } from './use-profile-form';

/**
 * Owns the single RHF form spanning both the Profile and Preferences sections
 * plus the sticky save bar — they must live under one <form> so one save
 * commits body metrics, region, and cooking together.
 */
export function SettingsForm({ profile }: { profile: ProfileInput }) {
  const { form, isPending, onSubmit, handleCancel } = useProfileForm(profile);

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="font-sans-display">
        <FormBody
          form={form}
          isPending={isPending}
          savedCalorieTarget={profile.calorieTarget}
          onCancel={handleCancel}
        />
      </form>
    </Form>
  );
}

// The live-target reads use useWatch, which must run inside the FormProvider
// that <Form> establishes — so the body (and the save bar that names the live
// target) live in this child rendered under <Form>.
function FormBody({
  form,
  isPending,
  savedCalorieTarget,
  onCancel,
}: {
  form: UseFormReturn<ProfileFormValues>;
  isPending: boolean;
  savedCalorieTarget: number | null;
  onCancel: () => void;
}) {
  const t = useTranslations('settings');
  const live = useLiveTargets();

  return (
    <>
      <section id={PROFILE_ANCHOR} className="mb-8 scroll-mt-20">
        <SectionHeader
          title={t('profile')}
          description={t('profileDescription')}
        />
        {/* Hairlines separate subsections, not individual rows — each wrapper
            div below is one direct child of the group's divide-y. */}
        <SettingsGroup>
          <div>
            <IdentityRows />
          </div>
          <div id={SUBSECTION_ANCHOR['body-metrics']} className="scroll-mt-20">
            <MetricsFields />
            <GoalFields
              tdee={live.tdee}
              targetCalories={live.targetCalories}
              goal={live.goal}
            />
            {live.tdee !== null && live.macros && (
              <TargetHero
                tdee={live.tdee}
                targetCalories={live.targetCalories}
                macros={live.macros}
                savedCalorieTarget={savedCalorieTarget}
                goal={live.goal}
                aggression={live.aggression}
              />
            )}
          </div>
        </SettingsGroup>
      </section>

      <section id={PREFERENCES_ANCHOR} className="mb-8 scroll-mt-20">
        <SectionHeader
          title={t('preferences')}
          description={t('preferencesDescription')}
        />
        <SettingsGroup>
          <RegionalRows />
          <div id={SUBSECTION_ANCHOR.cooking} className="scroll-mt-20">
            <CookingRows />
          </div>
        </SettingsGroup>
      </section>

      <SaveBar
        isDirty={form.formState.isDirty}
        isPending={isPending}
        pendingTarget={live.pendingTarget}
        onCancel={onCancel}
      />
    </>
  );
}
