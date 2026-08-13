export const STATE_SUFFIX_TOKENS = new Set([
  'luộc',
  'hấp',
  'nướng',
  'rán',
  'chiên',
  'khô',
  'rang',
  'muối',
  'tươi',
  'sống',
  'hộp',
  'chần',
  'quay',
  'nấu',
  'hầm',
  'xào',
  'chín',
  'kho',
  'tần',
]);

export const COOKING_TOKENS = new Set([
  'luộc',
  'hấp',
  'nướng',
  'rán',
  'chiên',
  'rang',
  'chần',
  'quay',
  'nấu',
  'hầm',
  'xào',
  'kho',
  'tần',
]);

export function normalizeText(value: string): string {
  return value
    .normalize('NFC')
    .toLocaleLowerCase('vi')
    .replace(/[()[\]{}.,:;/\\+_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokens(value: string): string[] {
  return normalizeText(value).split(' ').filter(Boolean);
}

export function foldText(value: string): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replaceAll('đ', 'd');
}
