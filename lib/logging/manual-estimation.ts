export const LOGGING_MODE_VALUES = ['default', 'manual'] as const;
export type LoggingMode = (typeof LOGGING_MODE_VALUES)[number];

export const PORTION_CERTAINTY_VALUES = ['exact', 'rough', 'estimate'] as const;
export type PortionCertainty = (typeof PORTION_CERTAINTY_VALUES)[number];

export const MEAL_CONTEXT_VALUES = [
  'home_cooked',
  'restaurant',
  'packaged',
  'shared_buffet',
] as const;
export type MealContext = (typeof MEAL_CONTEXT_VALUES)[number];

export const KNOWN_DETAIL_TYPE_VALUES = [
  'grams',
  'serving_size',
  'exact_packaged_item',
] as const;
export type KnownDetailType = (typeof KNOWN_DETAIL_TYPE_VALUES)[number];

export interface GramsKnownDetail {
  type: 'grams';
  grams: number;
}

export interface ServingSizeKnownDetail {
  type: 'serving_size';
  quantity: number;
  label: string;
}

export interface ExactPackagedItemKnownDetail {
  type: 'exact_packaged_item';
  packageLabel: string;
  servingLabel?: string;
}

export type KnownDetailInput =
  | GramsKnownDetail
  | ServingSizeKnownDetail
  | ExactPackagedItemKnownDetail;

export interface ManualLoggingContext {
  loggingMode: LoggingMode;
  portionCertainty?: PortionCertainty;
  mealContext?: MealContext;
  knownDetails?: KnownDetailInput[];
}

export interface ManualItem {
  id: string;
  qty: string;
  name: string;
}

export function createDefaultManualItem(id: string): ManualItem {
  return { id, qty: '', name: '' };
}

export function serializeItemsToText(items: ManualItem[]): string {
  return items
    .filter((item) => item.qty.trim() || item.name.trim())
    .map((item) =>
      [item.qty.trim(), item.name.trim()].filter(Boolean).join(' ')
    )
    .join(', ');
}

export function hasCompleteItem(items: ManualItem[]): boolean {
  return items.some(
    (item) => item.qty.trim().length > 0 && item.name.trim().length > 0
  );
}

export interface ManualLoggingFormState {
  mealContext: MealContext | null;
  items: ManualItem[];
}

export function createDefaultManualLoggingFormState(): ManualLoggingFormState {
  return {
    mealContext: null,
    items: [createDefaultManualItem(crypto.randomUUID())],
  };
}

export function buildManualLoggingRequest(
  state: ManualLoggingFormState,
  isManual: boolean
): ManualLoggingContext | Record<string, unknown> {
  if (!isManual) {
    return { loggingMode: 'default' };
  }

  return {
    loggingMode: 'manual',
    portionCertainty: 'rough',
    mealContext: state.mealContext ?? undefined,
  };
}
