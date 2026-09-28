'use client';

import type { LucideIcon } from 'lucide-react';
import { PencilLine } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ResponsiveSheetHeader } from '@/components/shared/responsive-sheet-header';
import { SheetCapsuleButton } from '@/components/shared/sheet-capsule-button';
import { SurfaceState } from '@/components/shared/surface-state/surface-state';
import type { SurfaceKind } from '@/lib/brand/illustrations/cast';
import { cn } from '@/lib/core/ui/cn';
import { ScanPanel } from './scan-panel';

export interface ScanStateAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}

/**
 * A miss over the camera — the Flutter app's `ScanStatePanel`: the app's
 * empty/error state (the otter, the Lora title, the reason), the ways on as
 * full-width buttons at the bottom (the first filled beige, the rest quiet),
 * and "Enter manually" where Edit sits on a result.
 */
export function ScanStatePanel({
  kind,
  title,
  message,
  actions,
  onClose,
  onEnterManually,
}: {
  kind: SurfaceKind;
  title: string;
  message: string;
  actions: ScanStateAction[];
  onClose: () => void;
  onEnterManually: () => void;
}) {
  const t = useTranslations('logging.scan');
  return (
    <ScanPanel
      level="fit"
      label={title}
      header={
        <ResponsiveSheetHeader
          title=""
          closeLabel={t('close')}
          onClose={onClose}
          trailing={
            <SheetCapsuleButton
              label={t('enterManually')}
              icon={PencilLine}
              onClick={onEnterManually}
            />
          }
        />
      }
      dock={
        <div className="flex flex-col gap-1">
          {actions.map(({ label, icon: Icon, onClick }, i) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className={cn(
                'flex h-[52px] items-center justify-center gap-2 rounded-full font-semibold text-[16px] text-kallo-text transition-colors',
                i === 0
                  ? 'bg-kallo-hover hover:bg-kallo-border'
                  : 'hover:bg-kallo-hover'
              )}
            >
              <Icon className="size-5" strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </div>
      }
    >
      <SurfaceState
        area="logging"
        kind={kind}
        title={title}
        subtitle={message}
        className="px-6 pt-2 pb-8"
      />
    </ScanPanel>
  );
}
