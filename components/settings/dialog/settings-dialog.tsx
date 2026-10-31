'use client';

import { SaveBar } from '@/components/settings/profile/save-bar';
import { Form } from '@/components/ui/form';
import { useProfileForm } from '@/hooks/profile/use-profile-form';
import { SettingsFrame } from './frame';
import type { SettingsAccount, SettingsProfile } from './types';

interface SettingsDialogProps extends SettingsAccount {
  profile: SettingsProfile | null;
}

/**
 * Settings, as a dialog over whatever app page is showing. Opened from the
 * sidebar, the user menu and the phone account sheet through the URL
 * (`useSettingsDialog`). Mounted once in the app layout for the whole session,
 * so the profile form's unsaved edits survive the dialog closing.
 */
export function SettingsDialog({ profile, ...account }: SettingsDialogProps) {
  if (!profile) {
    return <SettingsFrame profile={null} profileForm={null} {...account} />;
  }
  return <ProfileSettingsDialog profile={profile} {...account} />;
}

// One form spans Body & goal, Preferences and Cooking, so one save commits
// body metrics, region and cooking together.
function ProfileSettingsDialog({
  profile,
  ...account
}: SettingsAccount & { profile: SettingsProfile }) {
  const { form, isPending, onSubmit, handleCancel } = useProfileForm(profile);

  return (
    <Form {...form}>
      <SettingsFrame
        profile={profile}
        {...account}
        profileForm={{
          onSubmit,
          saveBar: (
            <SaveBar
              isPending={isPending}
              onSave={onSubmit}
              onCancel={handleCancel}
            />
          ),
        }}
      />
    </Form>
  );
}
