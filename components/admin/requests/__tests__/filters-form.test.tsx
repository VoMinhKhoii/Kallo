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

import { FiltersForm } from '../filters-form';

describe('FiltersForm', () => {
  beforeEach(() => pushSpy.mockClear());

  it('pushes only page=1 when nothing is filled in', async () => {
    render(<FiltersForm current={{}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(pushSpy).toHaveBeenCalledWith('/admin/requests?page=1');
  });

  it('seeds the fields from the current query and round-trips them', async () => {
    render(
      <FiltersForm
        current={{
          status: 'error',
          userId: 'user-9',
          dateFrom: '2026-01-01',
          dateTo: '2026-02-01',
          includeReplays: 'true',
        }}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(pushSpy).toHaveBeenCalledWith(
      '/admin/requests?status=error&userId=user-9&dateFrom=2026-01-01&dateTo=2026-02-01&includeReplays=true&page=1'
    );
  });

  it('treats includeReplays=1 as checked', () => {
    render(<FiltersForm current={{ includeReplays: '1' }} />);
    expect(screen.getByLabelText('Include replays')).toBeChecked();
  });

  it('omits status when it is the "all" sentinel', async () => {
    render(<FiltersForm current={{ status: 'all', userId: 'u' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(pushSpy).toHaveBeenCalledWith('/admin/requests?userId=u&page=1');
  });

  it('trims the user id before putting it in the query', async () => {
    render(<FiltersForm current={{ userId: '  spaced  ' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(pushSpy).toHaveBeenCalledWith(
      '/admin/requests?userId=spaced&page=1'
    );
  });

  it('drops a whitespace-only user id entirely', async () => {
    render(<FiltersForm current={{ userId: '   ' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(pushSpy).toHaveBeenCalledWith('/admin/requests?page=1');
  });

  it('clears the fields and navigates to the bare route on reset', async () => {
    render(
      <FiltersForm current={{ userId: 'user-9', includeReplays: 'true' }} />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(pushSpy).toHaveBeenCalledWith('/admin/requests');
    expect(screen.getByLabelText('Include replays')).not.toBeChecked();
    expect(screen.getByLabelText('User ID (UUID)')).toHaveValue('');
  });
});
