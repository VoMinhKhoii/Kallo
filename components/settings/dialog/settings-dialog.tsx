'use client';

import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ReactNode } from 'react';
import { SaveBar } from '@/components/settings/profile/save-bar';
import { DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { useProfileForm } from '@/hooks/profile/use-profile-form';
import { useSettingsDialog } from '@/hooks/settings/use-settings-dialog';
import { useIsMobile } from '@/hooks/ui/use-mobile';
import {
  isSettingsPageVisible,
  type SettingsPageId,
} from '@/lib/domain/settings/pages';
import { PageContent } from './page-content';
import { SheetLayout } from './sheet-layout';
import { SplitLayout } from './split-layout';
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
  if (!profile) return <SettingsFrame profile={null} {...account} />;
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
        onProfileSubmit={onSubmit}
        saveBar={
          <SaveBar
            isPending={isPending}
            onSave={onSubmit}
            onCancel={handleCancel}
          />
        }
      />
    </Form>
  );
}

interface SettingsFrameProps extends SettingsAccount {
  profile: SettingsProfile | null;
  onProfileSubmit?: () => void;
  saveBar?: ReactNode;
}

function SettingsFrame({
  profile,
  userId,
  email,
  onProfileSubmit,
  saveBar = null,
}: SettingsFrameProps) {
  const settings = useSettingsDialog();
  const isMobile = useIsMobile();

  const isVisible = (page: SettingsPageId) =>
    isSettingsPageVisible(page, profile !== null);
  const page = settings.page && isVisible(settings.page) ? settings.page : null;
  const Layout = isMobile ? SheetLayout : SplitLayout;

  return (
    <DialogPrimitive.Root
      open={settings.isOpen}
      onOpenChange={(open) => {
        if (!open) settings.close();
      }}
    >
      <DialogPortal>
        <DialogOverlay />
        <Layout
          page={page}
          onShow={settings.show}
          isVisible={isVisible}
          saveBar={saveBar}
          renderPage={(current) => (
            <PageContent
              page={current}
              profile={profile}
              userId={userId}
              email={email}
              onProfileSubmit={onProfileSubmit}
            />
          )}
        />
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}
