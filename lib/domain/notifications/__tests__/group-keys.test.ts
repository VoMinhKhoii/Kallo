import { describe, expect, it } from 'vitest';
import {
  friendJoinedKey,
  groupAddedKey,
  shareInviteAcceptedKey,
  shareInviteKey,
  shareLoggedKey,
  shareReactionKey,
  shareReplyKey,
} from '@/lib/domain/notifications/group-keys';

const ID = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';

describe('notification group keys', () => {
  it('prefixes every key with its event type', () => {
    expect(friendJoinedKey(ID)).toBe(`friend.joined:${ID}`);
    expect(groupAddedKey(ID)).toBe(`group.added:${ID}`);
    expect(shareInviteKey(ID)).toBe(`share.invite:${ID}`);
    expect(shareInviteAcceptedKey(ID)).toBe(`share.invite_accepted:${ID}`);
    expect(shareReactionKey(ID)).toBe(`share.reaction:${ID}`);
    expect(shareReplyKey(ID)).toBe(`share.reply:${ID}`);
    expect(shareLoggedKey(ID)).toBe(`share.logged:${ID}`);
  });

  // The type prefix is what stops a reaction and a reply on the SAME share
  // from upserting into one row.
  it('separates event kinds that share an id', () => {
    const keys = new Set([
      shareReactionKey(ID),
      shareReplyKey(ID),
      shareLoggedKey(ID),
      shareInviteKey(ID),
    ]);
    expect(keys.size).toBe(4);
  });

  it('is stable — the same id always aggregates into the same row', () => {
    expect(shareReactionKey(ID)).toBe(shareReactionKey(ID));
  });
});
