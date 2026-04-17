import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata.dashboard');

  return {
    title: t('title'),
  };
}

export default function DashboardPage() {
  return <DashboardShell />;
}
