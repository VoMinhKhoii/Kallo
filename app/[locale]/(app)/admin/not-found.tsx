import { useTranslations } from 'next-intl';
import { SurfaceState } from '@/components/shared/surface-state/surface-state';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export default function AdminNotFound() {
  const t = useTranslations('common');

  return (
    <SurfaceState
      action={
        <Button asChild size="sm" variant="outline">
          <Link href="/admin">{t('back')}</Link>
        </Button>
      }
      area="system"
      className="min-h-[40vh]"
      kind="notFound"
      subtitle={t('notFoundBody')}
      title={t('notFound')}
    />
  );
}
