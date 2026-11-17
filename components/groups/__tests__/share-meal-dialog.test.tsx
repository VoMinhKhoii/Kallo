import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
const friends = vi.hoisted(() => ({ list: [] as unknown[] }));
vi.mock('@/hooks/social/circle/use-friends', () => ({
  useFriends: () => ({
    data: friends.list,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/hooks/profile/use-profile', () => ({
  useMyProfile: () => ({ data: undefined }),
}));
vi.mock('@/hooks/social/sharing/use-share-meal-with-friends', () => ({
  useShareMealWithFriends: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock('@/hooks/ui/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/components/shared/surface-state/surface-state', () => ({
  SurfaceState: ({ title }: { title: string }) => <p>{title}</p>,
}));

import { ShareMealDialog } from '@/components/groups/share-meal-dialog';

describe('ShareMealDialog', () => {
  it('mounts closed without throwing', () => {
    // Regression: the even-split check ran `evenParts(seated.length + 1)` in a
    // render-time memo, and with nobody seated that is `evenParts(1)`, which
    // throws by contract. The dialog mounts with its trigger on EVERY meal
    // card, so this crashed the whole logging feed without anyone opening it.
    expect(() =>
      render(
        <ShareMealDialog
          mealId="meal-1"
          mealName="Bánh mì thịt nướng"
          totalKcal={1040}
          trigger={<button type="button">Share</button>}
        />
      )
    ).not.toThrow();

    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
  });

  function openWithFriend(copyOnly: boolean) {
    friends.list = [
      {
        status: 'accepted',
        profile: { userId: 'u1', handle: 'noah', displayName: 'Noah' },
      },
    ];
    render(
      <ShareMealDialog
        copyOnly={copyOnly}
        mealId="meal-1"
        mealName="Bánh mì thịt nướng"
        totalKcal={1040}
        trigger={<button type="button">Share</button>}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    fireEvent.click(screen.getByRole('button', { name: /Noah/ }));
  }

  it('opens on the split tab', () => {
    openWithFriend(false);
    expect(screen.getByRole('tab', { name: 'mode.split' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getAllByRole('slider')).toHaveLength(1);
  });

  it('opens a cheat meal whole, with no tabs', () => {
    openWithFriend(true);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.queryAllByRole('slider')).toHaveLength(0);
  });
});
