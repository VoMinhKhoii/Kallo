export type OcrCameraError = 'permission_denied' | 'unavailable';

export interface OcrCameraDevice {
  id: string;
  label: string;
}

export interface OcrCameraResolution {
  width: number;
  height: number;
}

export interface OcrCameraCapabilities {
  torch: boolean;
  focusModes: string[];
  resolutions: OcrCameraResolution[];
}
