import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationItem } from '@/lib/domain/notifications/contracts';
import { notificationKeys } from '@/lib/domain/notifications/query-keys';
import { ShareInviteRow } from '../share-invite-row';

const { acceptMock, dismissMock } = vi.hoisted(() => ({
  acceptMock: vi.fn(),
  dismissMock: vi.fn(),
}));

vi.mock('@/hooks/social/sharing/use-meal-share-invites', () => ({
  useAcceptMealShareInvite: () => ({ mutate: acceptMock, isPending: false }),
  useDismissMealShareInvite: () => ({ mutate: dismissMock, isPending: false }),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

function item(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'n1',
    type: 'share.invite',
    actors: [
      {
        userId: 'u1',
        handle: 'minh',
        displayName: 'Minh',
        avatarSeed: null,
        avatarUrl: null,
        hasCustomAvatar: false,
      },
    ],
    actorCount: 1,
    objectType: 'invite',
    objectId: 'invite-1',
    targetType: null,
    targetId: null,
    data: { mode: 'split', portionFactor: 0.5 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    seenAt: null,
    readAt: null,
    invite: { status: 'pending' },
    ...overrides,
  };
}

function renderRow(notification: NotificationItem) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    client,
    ...render(<ShareInviteRow item={notification} isNew={false} />, {
      wrapper,
    }),
  };
}

describe('ShareInviteRow', () => {
  beforeEach(() => {
    acceptMock.mockReset();
    dismissMock.mockReset();
  });

  it('offers accept and dismiss while the live invite is pending', () => {
    renderRow(item());

    expect(
      screen.getByRole('button', { name: 'invite.accept' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'invite.dismiss' })
    ).toBeInTheDocument();
    expect(screen.getByText('invite.modeSplit')).toBeInTheDocument();
  });

  it.each([
    [{ status: 'accepted' }, 'invite.status.accepted'],
    [{ status: 'dismissed' }, 'invite.status.dismissed'],
    [null, 'invite.status.unavailable'],
  ])('collapses to a chip when the invite is %o', (invite, chip) => {
    renderRow(item({ invite }));

    expect(screen.getByText(chip)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'invite.accept' })
    ).not.toBeInTheDocument();
  });

  it('treats a missing object id as unavailable rather than a dead button', () => {
    renderRow(item({ objectId: null }));

    expect(screen.getByText('invite.status.unavailable')).toBeInTheDocument();
  });

  it('passes the object id as the invite id and refreshes activity on success', async () => {
    const user = userEvent.setup();
    const { client } = renderRow(item());
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    await user.click(screen.getByRole('button', { name: 'invite.accept' }));

    expect(acceptMock).toHaveBeenCalledWith(
      'invite-1',
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    acceptMock.mock.calls[0][1].onSuccess();
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: notificationKeys.all,
    });
  });

  it('sends a dismiss through the same guarded mutation', async () => {
    const user = userEvent.setup();
    const { client } = renderRow(item());
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    await user.click(screen.getByRole('button', { name: 'invite.dismiss' }));

    expect(dismissMock).toHaveBeenCalledWith(
      'invite-1',
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    dismissMock.mock.calls[0][1].onSuccess();
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: notificationKeys.all,
    });
  });
});
