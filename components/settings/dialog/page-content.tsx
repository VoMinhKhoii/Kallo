'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useFormState } from 'react-hook-form';
import { AccountPanel } from '@/components/settings/account/account-panel';
import { ExportRow } from '@/components/settings/account/export-row';
import { AppearanceRow } from '@/components/settings/appearance/appearance-row';
import { LanguageRow } from '@/components/settings/appearance/language-row';
import { SettingsGroup } from '@/components/settings/chrome/group';
import { SectionHeader } from '@/components/settings/chrome/section-header';
import { FeedbackPanel } from '@/components/settings/feedback/feedback-panel';
import { IdentityRows } from '@/components/settings/identity/identity-rows';
import { PlanRows } from '@/components/settings/plan/plan-rows';
import { AiConsentRow } from '@/components/settings/privacy/ai-consent-row';
import { BodyGoalRows } from '@/components/settings/profile/body-goal-rows';
import { CookingRows } from '@/components/settings/profile/cooking-rows';
import { RegionalRows } from '@/components/settings/profile/regional-rows';
import { SetupPrompt } from '@/components/settings/profile/setup-prompt';
import { SharingRow } from '@/components/settings/sharing/sharing-row';
import type { SettingsPageId } from '@/lib/domain/settings/pages';
import type { SettingsAccount, SettingsProfile } from './types';

interface PageContentProps extends SettingsAccount {
  page: SettingsPageId;
  profile: SettingsProfile | null;
  /** Submits the profile form; wraps its pages so Enter in a field saves. */
  onProfileSubmit?: () => void;
}

/** One settings page: its header, then the rows it owns. */
export function PageContent({
  page,
  profile,
  userId,
  email,
  onProfileSubmit,
}: PageContentProps) {
  const t = useTranslations('settings.pages');
  const locale = useLocale();

  // Pages holding profile-form fields sit inside a <form> so Enter submits;
  // the save bar itself sits outside it, because it shows on every page.
  const profileForm = (rows: ReactNode) =>
    onProfileSubmit ? (
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onProfileSubmit();
        }}
      >
        {rows}
        <ImplicitSubmit />
      </form>
    ) : (
      rows
    );

  const body = (() => {
    switch (page) {
      case 'profile':
        return (
          <>
            <SettingsGroup>
              <IdentityRows />
            </SettingsGroup>
            {!profile && <SetupPrompt />}
          </>
        );
      case 'body':
        return profile
          ? profileForm(
              <BodyGoalRows savedCalorieTarget={profile.calorieTarget} />
            )
          : null;
      case 'preferences':
        return profileForm(
          <SettingsGroup>
            <LanguageRow />
            {/* A device setting, not a profile one: the theme applies
                before a profile exists. */}
            <AppearanceRow />
            {profile && <RegionalRows />}
          </SettingsGroup>
        );
      case 'cooking':
        return profile
          ? profileForm(
              <SettingsGroup>
                <CookingRows />
              </SettingsGroup>
            )
          : null;
      case 'privacy':
        return (
          <SettingsGroup>
            {profile && <SharingRow initialValue={profile.autoShareToCircle} />}
            {profile && <AiConsentRow />}
            <ExportRow userId={userId} />
          </SettingsGroup>
        );
      case 'plan':
        return <PlanRows userId={userId} locale={locale} />;
      case 'account':
        return <AccountPanel userId={userId} email={email} />;
      case 'feedback':
        return <FeedbackPanel />;
    }
  })();

  return (
    <>
      <SectionHeader
        title={t(`${page}.title`)}
        description={t(`${page}.description`)}
      />
      {body}
    </>
  );
}

/**
 * A form with several text fields and no submit button ignores Enter, and the
 * save bar's button lives outside the form. This stand-in gives Enter a
 * target while there is something to save, as the old page's save bar did.
 */
function ImplicitSubmit() {
  const { isDirty } = useFormState();
  if (!isDirty) return null;
  return (
    <button type="submit" tabIndex={-1} aria-hidden="true" className="sr-only">
      {/* No label: never reached by focus or a screen reader. */}
    </button>
  );
}
