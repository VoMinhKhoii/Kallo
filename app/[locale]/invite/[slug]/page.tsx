import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { ConnectPanel } from '@/components/groups/invite/connect-panel';
import { InviteAuthCta } from '@/components/groups/invite/invite-auth-cta';
import { Link } from '@/i18n/navigation';
import { getFriendshipStatus } from '@/lib/actions/groups/friendship';
import {
  getMyPublicProfile,
  getProfileBySlug,
} from '@/lib/actions/groups/profile';
import type { PublicProfile } from '@/lib/actions/groups/types';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** Centered cream card shared by every invite state. */
function Shell({
  profile,
  title,
  body,
  children,
}: {
  profile?: Pick<PublicProfile, 'displayName' | 'handle'>;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  const label = profile ? profile.displayName?.trim() || profile.handle : null;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-nham-surface px-5 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        {label ? (
          <span className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-nham-accent/40 to-nham-border/50 ring-1 ring-nham-accent/25">
            <span className="font-bold font-sans-display text-2xl text-nham-btn">
              {label.charAt(0).toUpperCase()}
            </span>
          </span>
        ) : null}
        <div className="space-y-2">
          <h1 className="font-normal font-serif text-2xl text-nham-text tracking-tight">
            {title}
          </h1>
          <p className="font-sans-display text-nham-text-muted text-sm leading-relaxed">
            {body}
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = await getTranslations('groups.connect');

  const inviter = await getProfileBySlug(slug);
  if (!inviter) {
    return <Shell title={t('invalidTitle')} body={t('invalidBody')} />;
  }
  const name = inviter.displayName?.trim() || inviter.handle;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed out: keep auth ON this page — the dialog opens over the inviter's
  // card and `next` round-trips back here (now signed in → Connect). No more
  // teleport to the marketing page that erased the friend at commitment.
  if (!user) {
    const invitePath = `/${locale}/invite/${inviter.handle}`;
    return (
      <Shell
        profile={inviter}
        title={t('signedOutTitle', { name })}
        body={t('signedOutBody')}
      >
        <InviteAuthCta next={invitePath} />
      </Shell>
    );
  }

  // Your own link.
  if (user.id === inviter.userId) {
    return (
      <Shell title={t('selfTitle')} body={t('selfBody')}>
        <CircleLink label={t('goToCircle')} />
      </Shell>
    );
  }

  const status = await getFriendshipStatus(user.id, inviter.userId);
  if (status === 'accepted') {
    return (
      <Shell
        profile={inviter}
        title={t('alreadyTitle', { name })}
        body={t('alreadyBody')}
      >
        <CircleLink label={t('goToCircle')} />
      </Shell>
    );
  }
  if (status === 'blocked') {
    return <Shell title={t('invalidTitle')} body={t('invalidBody')} />;
  }

  // Connect: the recipient taps Accept, and the whole panel resolves in place
  // (their disc slides in beside the inviter's, the title crossfades to "You're
  // connected") rather than teleporting to an empty /groups.
  const myProfile = await getMyPublicProfile(user.id);
  const youLabel =
    myProfile?.displayName?.trim() || myProfile?.handle || t('you');

  return (
    <ConnectPanel
      slug={inviter.handle}
      inviterLabel={name}
      youLabel={youLabel}
    />
  );
}

function CircleLink({ label }: { label: string }) {
  return (
    <Link
      href="/groups"
      className="inline-flex items-center justify-center rounded-xl border border-nham-border/60 bg-white px-6 py-3 font-medium font-sans-display text-[15px] text-nham-text transition-colors hover:border-nham-accent/50"
    >
      {label}
    </Link>
  );
}
