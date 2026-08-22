'use client';

import type {
  OcrCameraCapabilities,
  OcrCameraDevice,
  OcrCameraResolution,
} from '@/lib/domain/nutrition/ocr/camera-types';

interface OcrCameraControlsProps {
  cameras: OcrCameraDevice[];
  selectedCameraId: string | null;
  capabilities: OcrCameraCapabilities;
  torchEnabled: boolean;
  focusMode: string | null;
  resolution: OcrCameraResolution | null;
  cameraLabel: string;
  cameraFallbackLabel: string;
  torchLabel: string;
  focusLabel: string;
  resolutionLabel: string;
  focusLabels: Record<string, string>;
  onCameraChange: (id: string) => void;
  onTorchChange: (enabled: boolean) => void;
  onFocusChange: (mode: string) => void;
  onResolutionChange: (resolution: OcrCameraResolution) => void;
}

export function OcrCameraControls(props: OcrCameraControlsProps) {
  const hasControls =
    props.cameras.length > 1 ||
    props.capabilities.torch ||
    props.capabilities.focusModes.length > 1 ||
    props.capabilities.resolutions.length > 1;
  if (!hasControls) return null;

  return (
    <div className="grid max-h-full grid-cols-1 gap-2 overflow-y-auto rounded-xl bg-black/60 p-2 text-white text-xs backdrop-blur-sm min-[380px]:grid-cols-2">
      {props.cameras.length > 1 && (
        <label className="space-y-1">
          <span>{props.cameraLabel}</span>
          <select
            value={props.selectedCameraId ?? ''}
            onChange={(event) => props.onCameraChange(event.target.value)}
            className="w-full rounded-md bg-white px-2 py-1 text-kallo-ink"
          >
            <option value="" disabled>
              {props.cameraLabel}
            </option>
            {props.cameras.map((camera, index) => (
              <option key={camera.id} value={camera.id}>
                {camera.label || `${props.cameraFallbackLabel} ${index + 1}`}
              </option>
            ))}
          </select>
        </label>
      )}
      {props.capabilities.torch && (
        <label className="flex items-center gap-2 self-end rounded-md bg-white/10 px-2 py-1.5">
          <input
            type="checkbox"
            checked={props.torchEnabled}
            onChange={(event) => props.onTorchChange(event.target.checked)}
          />
          {props.torchLabel}
        </label>
      )}
      {props.capabilities.focusModes.length > 1 && (
        <label className="space-y-1">
          <span>{props.focusLabel}</span>
          <select
            value={props.focusMode ?? ''}
            onChange={(event) => props.onFocusChange(event.target.value)}
            className="w-full rounded-md bg-white px-2 py-1 text-kallo-ink"
          >
            {props.capabilities.focusModes.map((mode) => (
              <option key={mode} value={mode}>
                {props.focusLabels[mode] ?? props.focusLabel}
              </option>
            ))}
          </select>
        </label>
      )}
      {props.capabilities.resolutions.length > 1 && (
        <label className="space-y-1">
          <span>{props.resolutionLabel}</span>
          <select
            value={
              props.resolution
                ? `${props.resolution.width}x${props.resolution.height}`
                : ''
            }
            onChange={(event) => {
              const next = props.capabilities.resolutions.find(
                (item) => `${item.width}x${item.height}` === event.target.value
              );
              if (next) props.onResolutionChange(next);
            }}
            className="w-full rounded-md bg-white px-2 py-1 text-kallo-ink"
          >
            {props.capabilities.resolutions.map((item) => (
              <option
                key={`${item.width}x${item.height}`}
                value={`${item.width}x${item.height}`}
              >
                {item.width} × {item.height}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
