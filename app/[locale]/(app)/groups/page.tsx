import { UserPlus } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AddFriendDialog } from '@/components/groups/add-friend-dialog';
import { CircleWall } from '@/components/groups/circle-wall';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata.groups');
  return { title: t('title') };
}

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string | string[] }>;
}) {
  const t = await getTranslations('groups.page');
  const { add } = await searchParams;
  const initialHandle = typeof add === 'string' ? add : undefined;

  return (
    <main className="flex-1 px-5 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1
              className="font-normal text-2xl text-nham-text tracking-tight"
              style={{ fontFamily: 'Lora, serif' }}
            >
              {t('title')}
            </h1>
            <p
              className="text-nham-text-muted text-sm"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              {t('subtitle')}
            </p>
          </div>

          <AddFriendDialog
            initialHandle={initialHandle}
            trigger={
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-nham-btn px-3.5 py-2 font-medium text-[13px] text-white shadow-nham-btn/20 shadow-sm transition-colors hover:bg-nham-btn/90"
                style={{ fontFamily: 'DM Sans, sans-serif' }}
              >
                <UserPlus className="h-4 w-4" />
                {t('addFriend')}
              </button>
            }
          />
        </header>

        <CircleWall />
      </div>
    </main>
  );
}
