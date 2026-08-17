/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pushSpy = vi.hoisted(() => vi.fn());
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: pushSpy }),
}));

import { FeedbackFilters } from '../feedback-filters';

describe('FeedbackFilters', () => {
  beforeEach(() => pushSpy.mockClear());

  it('pushes only page=1 when nothing is selected', async () => {
    render(<FeedbackFilters current={{}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(pushSpy).toHaveBeenCalledWith('/admin/feedback?page=1');
  });

  it('carries the seeded type and status into the query', async () => {
    render(<FeedbackFilters current={{ type: 'bug', status: 'triaged' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(pushSpy).toHaveBeenCalledWith(
      '/admin/feedback?type=bug&status=triaged&page=1'
    );
  });

  it('treats the "all" sentinel as no filter', async () => {
    render(<FeedbackFilters current={{ type: 'all', status: 'open' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(pushSpy).toHaveBeenCalledWith('/admin/feedback?status=open&page=1');
  });

  it('navigates to the bare route on reset', async () => {
    render(<FeedbackFilters current={{ type: 'bug', status: 'open' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(pushSpy).toHaveBeenCalledWith('/admin/feedback');
  });
});
