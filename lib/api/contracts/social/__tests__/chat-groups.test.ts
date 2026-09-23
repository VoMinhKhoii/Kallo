import { describe, expect, it } from 'vitest';
import {
  addChatGroupMembersBodySchema,
  createChatGroupBodySchema,
} from '@/lib/api/contracts/social/chat-groups';

const A = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const B = 'b1ffcd88-8d1a-4ef8-bb6d-6bb9bd380a22';

/** A distinct valid v4-shaped uuid per index, for the length bounds. */
const uuidAt = (i: number) =>
  `00000000-0000-4000-8000-${i.toString(16).padStart(12, '0')}`;

describe('createChatGroupBodySchema', () => {
  it('accepts the payload the web and Flutter clients send', () => {
    // lib/domain/social/chat/client.ts and chat_group_providers.dart both
    // post exactly `{ name, memberUserIds }`.
    expect(
      createChatGroupBodySchema.parse({
        name: 'Lunch crew',
        memberUserIds: [A, B],
      })
    ).toEqual({ name: 'Lunch crew', memberUserIds: [A, B] });
  });

  it('trims the name, and rejects an empty or whitespace-only one', () => {
    expect(
      createChatGroupBodySchema.parse({ name: '  Gym  ', memberUserIds: [A] })
        .name
    ).toBe('Gym');
    for (const name of ['', '   ']) {
      expect(() =>
        createChatGroupBodySchema.parse({ name, memberUserIds: [A] })
      ).toThrow();
    }
  });

  it('rejects a name longer than 60 characters', () => {
    expect(() =>
      createChatGroupBodySchema.parse({
        name: 'x'.repeat(61),
        memberUserIds: [A],
      })
    ).toThrow();
    expect(
      createChatGroupBodySchema.parse({
        name: 'x'.repeat(60),
        memberUserIds: [A],
      }).name
    ).toHaveLength(60);
  });

  it('rejects a missing or non-string name', () => {
    expect(() =>
      createChatGroupBodySchema.parse({ memberUserIds: [A] })
    ).toThrow();
    expect(() =>
      createChatGroupBodySchema.parse({ name: 42, memberUserIds: [A] })
    ).toThrow();
  });

  it('rejects memberUserIds that is not an array', () => {
    for (const memberUserIds of [A, { 0: A }, null, 7]) {
      expect(() =>
        createChatGroupBodySchema.parse({ name: 'G', memberUserIds })
      ).toThrow();
    }
  });

  it('rejects a non-uuid member id', () => {
    expect(() =>
      createChatGroupBodySchema.parse({
        name: 'G',
        memberUserIds: [A, 'not-a-uuid'],
      })
    ).toThrow();
  });

  it('rejects an empty list and more than 49 invitees', () => {
    expect(() =>
      createChatGroupBodySchema.parse({ name: 'G', memberUserIds: [] })
    ).toThrow();
    const fifty = Array.from({ length: 50 }, (_, i) => uuidAt(i));
    expect(() =>
      createChatGroupBodySchema.parse({ name: 'G', memberUserIds: fifty })
    ).toThrow();
  });

  it('dedupes and lowercases member ids', () => {
    expect(
      createChatGroupBodySchema.parse({
        name: 'G',
        memberUserIds: [A, A.toUpperCase(), B],
      }).memberUserIds
    ).toEqual([A, B]);
  });

  it('strips keys the contract does not declare', () => {
    const parsed = createChatGroupBodySchema.parse({
      name: 'G',
      memberUserIds: [A],
      createdBy: B,
      kind: 'direct',
    });
    expect(parsed).toEqual({ name: 'G', memberUserIds: [A] });
  });
});

describe('addChatGroupMembersBodySchema', () => {
  it('accepts the payload the web and Flutter clients send', () => {
    expect(addChatGroupMembersBodySchema.parse({ memberUserIds: [A] })).toEqual(
      { memberUserIds: [A] }
    );
  });

  it('rejects the `{ userId }` shape the old spec advertised', () => {
    expect(() => addChatGroupMembersBodySchema.parse({ userId: A })).toThrow();
  });

  it('rejects a non-array, a non-uuid, an empty and an oversized list', () => {
    for (const memberUserIds of [
      A,
      ['not-a-uuid'],
      [],
      Array.from({ length: 51 }, (_, i) => uuidAt(i)),
    ]) {
      expect(() =>
        addChatGroupMembersBodySchema.parse({ memberUserIds })
      ).toThrow();
    }
  });

  it('dedupes member ids and ignores a body-supplied groupId', () => {
    expect(
      addChatGroupMembersBodySchema.parse({
        memberUserIds: [B, B],
        groupId: A,
      })
    ).toEqual({ memberUserIds: [B] });
  });
});
