import { describe, expect, it } from 'vitest';
import { handleFromName } from '@/lib/domain/social/identity/handle-from-name';

describe('handleFromName', () => {
  it('strips Vietnamese diacritics including đ', () => {
    expect(handleFromName('Đặng Thu Hà')).toBe('dangthuha');
  });

  it('lowercases and drops spaces and punctuation', () => {
    expect(handleFromName('Khoi V. Minh!')).toBe('khoivminh');
  });

  it('keeps digits', () => {
    expect(handleFromName('Khoi 99')).toBe('khoi99');
  });

  it('truncates to 16 chars to leave room for a digit suffix', () => {
    expect(handleFromName('Nguyễn Thị Phương Thảo Linh')).toBe(
      'nguyenthiphuongt'
    );
  });

  it('returns null when fewer than 3 usable chars survive', () => {
    expect(handleFromName('🍜🍜🍜')).toBeNull();
    expect(handleFromName('Ơ ơ')).toBe(null);
    expect(handleFromName('  ')).toBeNull();
  });

  it('returns exactly 3 surviving chars', () => {
    expect(handleFromName(' Q&A!')).toBeNull(); // only "qa" survives
    expect(handleFromName('B.A.P')).toBe('bap');
  });

  it('may return a reserved word (service layer suffixes it)', () => {
    expect(handleFromName('Admin')).toBe('admin');
  });
});
