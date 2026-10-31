'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { SubscriptionSettings } from '@/components/billing/subscription/subscription-settings';
import { AccountPanel } from '@/components/settings/account/account-panel';
import { ExportRow } from '@/components/settings/account/export-row';
import { AppearanceRow } from '@/components/settings/appearance/appearance-row';
import { LanguageRow } from '@/components/settings/appearance/language-row';
import { SettingsGroup } from '@/components/settings/chrome/group';
import { SectionHeader } from '@/components/settings/chrome/section-header';
import { FeedbackPanel } from '@/components/settings/feedback/feedback-panel';
import { IdentityRows } from '@/components/settings/identity/identity-rows';
import { AiConsentRow } from '@/components/settings/privacy/ai-consent-row';
import { BodyGoalRows } from '@/components/settings/profile/body-goal-rows';
import { CookingRows } from '@/components/settings/profile/cooking-rows';
import { RegionalRows } from '@/components/settings/profile/regional-rows';
import { SetupPrompt } from '@/components/settings/profile/setup-prompt';
import { SharingRow } from '@/components/settings/sharing/sharing-row';
import type { SettingsPageId } from '@/lib/domain/settings/pages';
import { ProfileFormPage } from './profile-form-page';
import type {
  ProfileFormHandle,
  SettingsAccount,
  SettingsProfile,
} from './types';

interface PageContentProps extends SettingsAccount {
  page: SettingsPageId;
  profile: SettingsProfile | null;
  profileForm: ProfileFormHandle | null;
}

/** One settings page: its header, then the rows it owns. */
export function PageContent(props: PageContentProps) {
  const t = useTranslations('settings.pages');
  const locale = useLocale();

  return (
    <>
      <SectionHeader
        title={t(`${props.page}.title`)}
        description={t(`${props.page}.description`)}
      />
      {pageBody(props, locale)}
    </>
  );
}

function pageBody(
  { page, profile, profileForm, userId, email }: PageContentProps,
  locale: string
): ReactNode {
  // Pages holding profile-form fields sit inside its <form> so Enter saves.
  const withForm = (rows: ReactNode) =>
    profileForm ? (
      <ProfileFormPage onSubmit={profileForm.onSubmit}>{rows}</ProfileFormPage>
    ) : (
      rows
    );

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
      return (
        profile &&
        withForm(<BodyGoalRows savedCalorieTarget={profile.calorieTarget} />)
      );
    case 'preferences':
      return withForm(
        <SettingsGroup>
          <LanguageRow />
          {/* A device setting, not a profile one: the theme applies before
              a profile exists. */}
          <AppearanceRow />
          {profile && <RegionalRows />}
        </SettingsGroup>
      );
    case 'cooking':
      return (
        profile &&
        withForm(
          <SettingsGroup>
            <CookingRows />
          </SettingsGroup>
        )
      );
    case 'privacy':
      return (
        <SettingsGroup>
          {profile && <SharingRow initialValue={profile.autoShareToCircle} />}
          {profile && <AiConsentRow />}
          <ExportRow userId={userId} />
        </SettingsGroup>
      );
    case 'subscriptions':
      return <SubscriptionSettings userId={userId} locale={locale} />;
    case 'account':
      return <AccountPanel userId={userId} email={email} />;
    case 'feedback':
      return <FeedbackPanel />;
  }
}
