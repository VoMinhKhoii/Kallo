import { describe, expect, it } from 'vitest';
import {
  COOKING_METHOD_STATE,
  deriveExpectedState,
} from '@/lib/ai/pipeline/contracts/cooking-method-state';

describe('COOKING_METHOD_STATE lookup', () => {
  it('maps cooking methods to cooked', () => {
    for (const method of [
      'luộc',
      'hấp',
      'nướng',
      'kho',
      'chiên',
      'xào',
      'chưng',
    ]) {
      expect(COOKING_METHOD_STATE[method]).toBe('cooked');
    }
  });

  it('maps explicit raw indicators to raw', () => {
    for (const method of ['sống', 'tươi sống', 'tái']) {
      expect(COOKING_METHOD_STATE[method]).toBe('raw');
    }
  });
});

describe('deriveExpectedState', () => {
  it('returns explicit override when present', () => {
    expect(
      deriveExpectedState({ explicit: 'raw', dishMethod: 'luộc' })
    ).toEqual({
      state: 'raw',
      source: 'explicit',
    });
  });

  it('looks up the dish method when no override is present', () => {
    expect(
      deriveExpectedState({ explicit: undefined, dishMethod: 'luộc' })
    ).toEqual({
      state: 'cooked',
      source: 'method_lookup',
    });
  });

  it('returns unknown source for unmapped methods', () => {
    expect(
      deriveExpectedState({
        explicit: undefined,
        dishMethod: 'sa tế hỗn hợp',
      })
    ).toEqual({
      state: 'cooked',
      source: 'unknown',
    });
  });

  it('is case and whitespace tolerant while preserving diacritics', () => {
    expect(
      deriveExpectedState({ explicit: undefined, dishMethod: '  Luộc  ' })
        .source
    ).toBe('method_lookup');
  });

  it('does not unaccent lookup keys', () => {
    expect(
      deriveExpectedState({ explicit: undefined, dishMethod: 'luoc' }).source
    ).toBe('unknown');
  });

  it('weightBasis="raw" forces raw and beats both explicit and dish method', () => {
    expect(
      deriveExpectedState({
        explicit: 'cooked',
        dishMethod: 'nấu',
        weightBasis: 'raw',
      })
    ).toEqual({ state: 'raw', source: 'explicit' });
  });

  it('weightBasis="as_eaten" is a no-op (legacy behavior preserved)', () => {
    expect(
      deriveExpectedState({
        explicit: undefined,
        dishMethod: 'luộc',
        weightBasis: 'as_eaten',
      })
    ).toEqual({ state: 'cooked', source: 'method_lookup' });
  });
});
