import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmptyPrompt } from '@/components/logging/feed/composer/empty-prompt';

const profile = vi.hoisted(() => ({ data: undefined as unknown }));
vi.mock('@/hooks/profile/use-profile', () => ({
  useMyProfile: () => profile,
}));

describe('the empty-day prompt', () => {
  beforeEach(() => {
    profile.data = undefined;
  });

  it('greets by first name once the profile lands', () => {
    // The name arrives over the network a render or two after the prompt is
    // already on screen, so both phrasings have to work.
    profile.data = { displayName: 'Khôi Võ' };
    render(<EmptyPrompt />);
    // The global next-intl mock echoes keys, so the assertion is on WHICH
    // phrasing was asked for, and that the name was passed through.
    expect(screen.getByText(/Named$/)).toBeInTheDocument();
  });

  it('falls back to the impersonal phrasing with no name to use', () => {
    render(<EmptyPrompt />);
    expect(screen.queryByText(/Named$/)).not.toBeInTheDocument();
  });

  it('ignores a name too long to read as someone talking', () => {
    // "Time for lunch, Nguyễn Hoàng Minh Khôi Đệ Nhị?" is not a greeting.
    profile.data = { displayName: 'Bartholomewsworthington' };
    render(<EmptyPrompt />);
    expect(screen.queryByText(/Named$/)).not.toBeInTheDocument();
  });

  it('does not reshuffle when the name arrives', () => {
    const view = render(<EmptyPrompt />);
    const first = screen.getByRole('paragraph').textContent;

    profile.data = { displayName: 'Khôi' };
    view.rerender(<EmptyPrompt />);

    // A prompt that redrew the moment the profile resolved would read as a
    // glitch rather than a greeting: same phrasing, now personalised.
    expect(screen.getByRole('paragraph').textContent).toBe(`${first}Named`);
  });
});
