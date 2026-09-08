import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { shareReplyFixture } from '@/components/groups/__tests__/fixtures';

vi.mock('@/components/shared/profile-avatar', () => ({
  ProfileAvatar: () => null,
}));

import { ShareReplies } from '@/components/groups/share-thread/share-replies';

describe('ShareReplies', () => {
  it('says the thread is empty rather than rendering nothing', () => {
    render(<ShareReplies replies={[]} />);

    expect(screen.getByText('noReplies')).toBeInTheDocument();
  });

  it('drops the pill around a reply body — the page is the thread', () => {
    render(
      <ShareReplies replies={[shareReplyFixture({ body: 'looks great' })]} />
    );

    const body = screen.getByText('looks great');
    expect(body).toHaveClass('text-[15px]', 'text-kallo-text');
    expect(body.className).not.toContain('rounded-[18px]');
    expect(body.className).not.toContain('bg-kallo-track');
    expect(body.className).not.toContain('px-3.5');
    expect(screen.queryByText('noReplies')).not.toBeInTheDocument();
  });

  it('is the list and nothing else — the composer is its sibling', () => {
    // The field you answer in belongs to the page, not to the conversation:
    // this component takes no shareId and renders no input, so there is one
    // place that decides whom a reply is addressed to.
    const { container } = render(
      <ShareReplies replies={[shareReplyFixture()]} />
    );

    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('input')).toBeNull();
  });
});
