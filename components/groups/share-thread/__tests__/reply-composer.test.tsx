import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Local next-intl double: the placeholder's whole point is the interpolated
// author name — and its absence — which the global key-echoing mock would hide.
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string, values?: { name?: string }) => {
    if (key === 'replyTo') return `Reply to ${values?.name}…`;
    if (key === 'replyPlaceholder') return 'Reply…';
    return key;
  },
}));
vi.mock('@/components/shared/profile-avatar', () => ({
  ProfileAvatar: () => null,
}));
vi.mock('@/hooks/social/sharing/use-create-reply', () => ({
  useCreateReply: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock('@/hooks/profile/use-profile', () => ({
  useMyProfile: () => ({ data: null }),
}));

import { SHARE_ID } from '@/components/groups/__tests__/fixtures';
import { ReplyComposer } from '@/components/groups/share-thread/reply-composer';

describe('ReplyComposer', () => {
  it('opens addressed to the post author, with no toggle', () => {
    render(<ReplyComposer authorName="Minh" shareId={SHARE_ID} />);

    // The placeholder IS the affordance: there is no "Reply" link to press
    // first, and the interpolated name says whose post you are answering.
    expect(screen.getByPlaceholderText('Reply to Minh…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'reply' })).toBeNull();
  });

  it('drops the name on your own post — you are not replying to yourself', () => {
    // No author name is the caller's way of saying "this post is yours"; the
    // placeholder falls back to the plain "Reply…" rather than addressing the
    // reader by their own handle.
    render(<ReplyComposer shareId={SHARE_ID} />);

    expect(screen.getByPlaceholderText('Reply…')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Reply to/)).toBeNull();
  });
});
