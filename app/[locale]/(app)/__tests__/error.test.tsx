import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AppError from '../error';

vi.spyOn(console, 'error').mockImplementation(() => undefined);

describe('AppError', () => {
  // A failed server render only recovers if the segment is fetched again,
  // which is what `retry` does and `reset` did not.
  it('retries the segment from the server', async () => {
    const retry = vi.fn();
    render(<AppError error={new Error('boom')} retry={retry} />);

    await userEvent.click(screen.getByRole('button', { name: 'route.retry' }));

    expect(retry).toHaveBeenCalledOnce();
  });
});
