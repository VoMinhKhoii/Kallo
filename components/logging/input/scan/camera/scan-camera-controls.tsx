'use client';

import { Flashlight, Images, Keyboard, PencilLine, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import type { ScanMode } from '../scan-view';
import { ScanGlassButton } from './scan-glass-button';
import { ScanModeSwitch } from './scan-mode-switch';

/**
 * Everything that floats over the live camera — the Flutter app's
 * `ScanCameraControls`: close and the light on top; the mode switch, then the
 * tools, at the bottom. Barcode mode: "Type barcode" · (codes decode live) ·
 * "Enter manually". Label mode: "Library" · the shutter · "Enter manually".
 */
export function ScanCameraControls({
  mode,
  labelLocked,
  lightOn,
  onLight,
  onMode,
  onClose,
  onTypeBarcode,
  onPickFile,
  onShutter,
  onEnterManually,
}: {
  mode: ScanMode;
  labelLocked: boolean;
  lightOn: boolean;
  /** Absent where the camera has no light to turn on. */
  onLight?: () => void;
  onMode: (mode: ScanMode) => void;
  onClose: () => void;
  onTypeBarcode: () => void;
  onPickFile: (file: File) => void;
  onShutter: () => void;
  onEnterManually: () => void;
}) {
  const t = useTranslations('logging.scan');
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
      <div className="pointer-events-auto flex items-center justify-between p-3">
        <ScanGlassButton icon={X} label={t('close')} onClick={onClose} />
        {onLight && (
          <ScanGlassButton
            icon={Flashlight}
            label={t('light')}
            onClick={onLight}
            active={lightOn}
          />
        )}
      </div>

      <div className="pointer-events-auto flex flex-col items-center gap-4 bg-gradient-to-b from-transparent to-black/50 px-4 pt-10 pb-4">
        <ScanModeSwitch mode={mode} locked={labelLocked} onChange={onMode} />
        <div className="flex w-full items-start justify-between">
          {mode === 'barcode' ? (
            <ScanGlassButton
              icon={Keyboard}
              label={t('typeBarcode')}
              onClick={onTypeBarcode}
              size={52}
              captioned
            />
          ) : (
            <ScanGlassButton
              icon={Images}
              label={t('library')}
              onClick={() => fileInput.current?.click()}
              size={52}
              captioned
            />
          )}
          {mode === 'label' ? (
            <button
              type="button"
              aria-label={t('shutter')}
              onClick={onShutter}
              className="flex size-[74px] items-center justify-center rounded-full border-4 border-white"
            >
              <span className="size-[60px] rounded-full bg-white" />
            </button>
          ) : (
            <span className="w-[74px]" />
          )}
          <ScanGlassButton
            icon={PencilLine}
            label={t('enterManually')}
            onClick={onEnterManually}
            size={52}
            captioned
          />
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) onPickFile(file);
          }}
        />
      </div>
    </div>
  );
}
