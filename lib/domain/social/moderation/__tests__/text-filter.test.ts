import { describe, expect, it } from 'vitest';
import { AppError } from '@/lib/core/errors/app-error';
import { OBJECTIONABLE_TERMS } from '@/lib/domain/social/moderation/objectionable-terms';
import {
  assertAcceptableText,
  findObjectionableTerm,
} from '@/lib/domain/social/moderation/text-filter';

describe('findObjectionableTerm', () => {
  it.each([
    ['fuck this', 'fuck'],
    ['What the FUCK', 'fuck'],
    ['you are a slut!!', 'slut'],
    ['go kill yourself', 'kill yourself'],
    ["I'll kill you", "i'll kill you"],
    ['đồ đĩ', 'đĩ'],
    ['ĐỤ MÁ', 'đụ'],
    ['địt mẹ mày', 'địt'],
    ['dit me may', 'dit me'],
    // Handles split on underscores, so a handle cannot smuggle a term.
    ['fuck_you_123', 'fuck'],
  ])('flags %j', (text, term) => {
    expect(findObjectionableTerm(text)).toBe(term);
  });

  it('matches decomposed (NFD) Vietnamese input as well as NFC', () => {
    expect(findObjectionableTerm('lồn'.normalize('NFD'))).toBe('lồn');
  });

  // Food words and everyday Vietnamese that sit next to listed terms. Every one
  // of these must pass — a false positive blocks someone typing their lunch.
  it.each([
    'bò',
    'chả',
    'bún bò Huế',
    'chả cá Lã Vọng',
    'bưởi da xanh',
    'đu đủ xanh',
    'hạt óc chó',
    'mọi người ăn gì chưa',
    'các món',
    'cá kho tộ',
    'lòng lợn',
    'ngon chết đi được',
    'bánh đúc',
    'đít nồi', // the bottom of a pot
    'Scunthorpe sausages',
    'my therapist said eat more fibre',
    'a cocktail and a spotted dick',
    'grapes, shiitake, assassin bugs',
    'this workout will kill me',
    'food porn: a stacked burger',
    'faggots and peas',
  ])('lets %j through', (text) => {
    expect(findObjectionableTerm(text)).toBeNull();
  });

  it('ignores empty and punctuation-only text', () => {
    expect(findObjectionableTerm('')).toBeNull();
    expect(findObjectionableTerm('  !!! ... ')).toBeNull();
  });

  it('only ever lists lowercase, NFC terms (the input is normalised that way)', () => {
    for (const term of OBJECTIONABLE_TERMS) {
      expect(term).toBe(term.normalize('NFC').toLowerCase());
    }
  });
});

describe('assertAcceptableText', () => {
  it('throws a 422 objectionable_content AppError without echoing the term', () => {
    let caught: unknown;
    try {
      assertAcceptableText('ok', 'you whore');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect(caught).toMatchObject({
      code: 'objectionable_content',
      status: 422,
      retryable: false,
    });
    expect((caught as AppError).userMessage).not.toContain('whore');
  });

  it('skips null and undefined fields and passes clean text', () => {
    expect(() =>
      assertAcceptableText(null, undefined, 'Phở bò tái')
    ).not.toThrow();
  });
});
