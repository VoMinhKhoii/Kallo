'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { setAutoShareToCircle } from '@/lib/actions/sharing-preferences';

interface SharingPanelProps {
  initialValue: boolean;
}

export function SharingPanel({ initialValue }: SharingPanelProps) {
  const t = useTranslations('settings.sharing');
  const [enabled, setEnabled] = useState(initialValue);
  const [isPending, startTransition] = useTransition();

  const handleChange = (checked: boolean) => {
    const previous = enabled;
    setEnabled(checked);

    startTransition(async () => {
      try {
        await setAutoShareToCircle(checked);
      } catch {
        setEnabled(previous);
        toast.error(t('error'));
      }
    });
  };

  return (
    <div className="rounded-2xl border border-nham-border/70 bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[15px] text-nham-text">{t('autoShareLabel')}</p>
          <p className="mt-1 text-[12px] text-nham-text-muted">
            {t('autoShareHint')}
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={handleChange}
          disabled={isPending}
          aria-label={t('autoShareLabel')}
        />
      </div>
    </div>
  );
}
