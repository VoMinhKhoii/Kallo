import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string, values?: { count?: number }) =>
    key === 'earlierReplies' ? `${values?.count ?? 0} earlier replies` : key,
}));
vi.mock('@/components/shared/profile-avatar', () => ({
  ProfileAvatar: () => null,
}));
vi.mock('@/hooks/social/use-create-reply', () => ({
  useCreateReply: () => ({ isPending: false, mutate: vi.fn() }),
}));

import { ShareReplies } from '@/components/groups/share-replies';

describe('ShareReplies', () => {
  it('shows how many older replies are outside the bounded slice', () => {
    render(<ShareReplies shareId="share-id" replies={[]} repliesTotal={17} />);

    expect(screen.getByText('17 earlier replies')).toHaveClass(
      'text-[12px]',
      'text-[#6E6D66]'
    );
  });

  it('omits the earlier-reply line when the full thread is present', () => {
    render(<ShareReplies shareId="share-id" replies={[]} repliesTotal={0} />);

    expect(screen.queryByText(/earlier replies/)).not.toBeInTheDocument();
  });
});
