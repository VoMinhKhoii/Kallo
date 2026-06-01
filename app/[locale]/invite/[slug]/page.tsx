import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { InviteAccept } from '@/components/groups/invite/invite-accept';
import { Link } from '@/i18n/navigation';
import {
  getFriendshipStatus,
  getProfileBySlug,
  type PublicProfile,
} from '@/lib/actions/groups';
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
            <span
              className="font-bold text-2xl text-nham-btn"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              {label.charAt(0).toUpperCase()}
            </span>
          </span>
        ) : null}
        <div className="space-y-2">
          <h1
            className="font-normal text-2xl text-nham-text tracking-tight"
            style={{ fontFamily: 'Lora, serif' }}
          >
            {title}
          </h1>
          <p
            className="text-nham-text-muted text-sm leading-relaxed"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
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

  // Signed out: route to the landing auth dialog, returning here afterward.
  if (!user) {
    const invitePath = `/${locale}/invite/${inviter.handle}`;
    const href = `/${locale}?auth=sign-up&next=${encodeURIComponent(invitePath)}`;
    return (
      <Shell
        profile={inviter}
        title={t('signedOutTitle', { name })}
        body={t('signedOutBody')}
      >
        <a
          href={href}
          className="inline-flex items-center justify-center rounded-xl bg-nham-btn px-6 py-3 font-medium text-[15px] text-white shadow-nham-btn/20 shadow-sm transition-colors hover:bg-nham-btn/90"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {t('signIn')}
        </a>
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

  // Connect: the recipient taps Accept.
  return (
    <Shell
      profile={inviter}
      title={t('connectTitle', { name })}
      body={t('connectBody')}
    >
      <InviteAccept slug={inviter.handle} />
    </Shell>
  );
}

function CircleLink({ label }: { label: string }) {
  return (
    <Link
      href="/groups"
      className="inline-flex items-center justify-center rounded-xl border border-nham-border/60 bg-white px-6 py-3 font-medium text-[15px] text-nham-text transition-colors hover:border-nham-accent/50"
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      {label}
    </Link>
  );
}
