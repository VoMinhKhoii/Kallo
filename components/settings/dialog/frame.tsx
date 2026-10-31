'use client';

import { Dialog as DialogPrimitive } from 'radix-ui';
import { DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { useSettingsDialog } from '@/hooks/settings/use-settings-dialog';
import { useIsMobile } from '@/hooks/ui/use-mobile';
import { isSettingsPageVisible } from '@/lib/domain/settings/pages';
import { PageContent } from './page-content';
import { SheetLayout } from './sheet-layout';
import { SplitLayout } from './split-layout';
import type {
  ProfileFormHandle,
  SettingsAccount,
  SettingsProfile,
} from './types';

interface SettingsFrameProps extends SettingsAccount {
  profile: SettingsProfile | null;
  profileForm: ProfileFormHandle | null;
}

/**
 * The dialog itself: open while the URL says so, the rail-and-page layout on
 * desktop and the push-in sheet on phones. A page hidden from this user (body
 * or cooking before onboarding) falls back to no page.
 */
export function SettingsFrame({
  profile,
  profileForm,
  userId,
  email,
}: SettingsFrameProps) {
  const settings = useSettingsDialog();
  const isMobile = useIsMobile();
  const hasProfile = profile !== null;
  const page =
    settings.page && isSettingsPageVisible(settings.page, hasProfile)
      ? settings.page
      : null;
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
          hasProfile={hasProfile}
          saveBar={profileForm?.saveBar ?? null}
          renderPage={(current) => (
            <PageContent
              page={current}
              profile={profile}
              profileForm={profileForm}
              userId={userId}
              email={email}
            />
          )}
        />
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}
