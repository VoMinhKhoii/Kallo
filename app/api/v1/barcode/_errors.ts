// Re-exported so the barcode routes keep importing their error mapping from
// beside themselves; it lives in the domain layer because `lib/actions` and the
// analyze-meal pre-stream check throw the same envelope and may not import
// from `app/`.
export { mapBarcodeServiceError } from '@/lib/domain/barcode/errors';
