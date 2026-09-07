import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ShareReply } from '@/lib/domain/social/shares/replies';

// Local next-intl double: the placeholder's whole point is the interpolated
// author name, which the global key-echoing mock would hide.
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string, values?: { name?: string }) =>
    key === 'replyTo' ? `Reply to ${values?.name}…` : key,
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

import { ShareReplies } from '@/components/groups/share-replies';

function reply(overrides: Partial<ShareReply> = {}): ShareReply {
  return {
    id: 'r1',
    author: {
      userId: 'u2',
      handle: 'phofan',
      displayName: 'Phở Fan',
      avatarSeed: null,
      avatarUrl: null,
      hasCustomAvatar: false,
    },
    isSelf: false,
    body: 'looks great',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ShareReplies', () => {
  it('says the thread is empty rather than rendering nothing', () => {
    render(<ShareReplies authorName="Minh" replies={[]} shareId="share-id" />);

    expect(screen.getByText('noReplies')).toBeInTheDocument();
  });

  it('drops the pill around a reply body — the page is the thread', () => {
    render(
      <ShareReplies
        authorName="Minh"
        replies={[reply({ body: 'looks great' })]}
        shareId="share-id"
      />
    );

    const body = screen.getByText('looks great');
    expect(body).toHaveClass('text-[15px]', 'text-kallo-text');
    expect(body.className).not.toContain('rounded-[18px]');
    expect(body.className).not.toContain('bg-kallo-track');
    expect(body.className).not.toContain('px-3.5');
    expect(screen.queryByText('noReplies')).not.toBeInTheDocument();
  });

  it('opens the composer addressed to the post author, with no toggle', () => {
    render(<ShareReplies authorName="Minh" replies={[]} shareId="share-id" />);

    // The placeholder IS the affordance: there is no "Reply" link to press
    // first, and the interpolated name says whose post you are answering.
    expect(screen.getByPlaceholderText('Reply to Minh…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'reply' })).toBeNull();
  });
});
