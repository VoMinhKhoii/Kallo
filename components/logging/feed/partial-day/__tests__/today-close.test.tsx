import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TodayClose } from '../today-close';

describe('TodayClose', () => {
  it('closes today only after the confirmation is accepted', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <TodayClose
        calories={1240}
        closed={false}
        isClosing={false}
        onClose={onClose}
      />
    );

    await user.click(screen.getByRole('button', { name: /markComplete/ }));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(
      await screen.findByRole('button', { name: 'confirmAccept' })
    );

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('says the day is closed instead of offering it again', () => {
    render(
      <TodayClose calories={1240} closed isClosing={false} onClose={vi.fn()} />
    );

    expect(screen.getByRole('status')).toHaveTextContent('closed');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
