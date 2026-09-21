import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  useLogWeight: vi.fn(),
}));

vi.mock('@/hooks/weight/use-weight-mutations', () => ({
  useLogWeight: mocks.useLogWeight,
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { WeightLogDialog } from '../weight-log-dialog';

function renderDialog(todayWeight: number | null = null) {
  render(
    <WeightLogDialog
      currentWeight={61.5}
      todayWeight={todayWeight}
      todayDate="2026-09-21"
    />
  );
}

describe('WeightLogDialog', () => {
  beforeEach(() => {
    mocks.mutateAsync.mockReset();
    mocks.mutateAsync.mockResolvedValue(undefined);
    mocks.useLogWeight.mockReset();
    mocks.useLogWeight.mockReturnValue({
      isPending: false,
      mutateAsync: mocks.mutateAsync,
    });
  });

  it('opens with the established web-dialog anatomy and a prefilled field', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(
      screen.getByRole('button', { name: 'weightCard.logWeight' })
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('rounded-2xl', 'sm:max-w-md');
    expect(
      screen.getByRole('heading', { name: 'weightCard.logWeight' })
    ).toHaveClass('font-serif');
    const input = screen.getByLabelText('weightCard.inputLabel');
    expect(input).toHaveValue('61.5');
    expect(input).toHaveFocus();
    expect(screen.getByRole('button', { name: 'cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'save' })).toBeInTheDocument();
  });

  it('closes through Cancel without saving', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(
      screen.getByRole('button', { name: 'weightCard.logWeight' })
    );

    await user.click(screen.getByRole('button', { name: 'cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it('submits the existing value and closes after a successful save', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(
      screen.getByRole('button', { name: 'weightCard.logWeight' })
    );

    await user.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => {
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        loggedDate: '2026-09-21',
        weightKg: 61.5,
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('normalizes a decimal comma before saving', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(
      screen.getByRole('button', { name: 'weightCard.logWeight' })
    );
    const input = screen.getByLabelText('weightCard.inputLabel');
    await user.clear(input);
    await user.type(input, '62,3');

    await user.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => {
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        loggedDate: '2026-09-21',
        weightKg: 62.3,
      });
    });
  });

  it('keeps the dialog open and shows inline validation for an invalid value', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(
      screen.getByRole('button', { name: 'weightCard.logWeight' })
    );
    const input = screen.getByLabelText('weightCard.inputLabel');
    await user.clear(input);
    await user.type(input, '20');

    await user.click(screen.getByRole('button', { name: 'save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cân nặng phải lớn hơn hoặc bằng 30 kg.'
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it('uses Update copy for an existing entry and disables it while pending', async () => {
    mocks.useLogWeight.mockReturnValue({
      isPending: true,
      mutateAsync: mocks.mutateAsync,
    });
    const user = userEvent.setup();
    renderDialog(60.8);

    await user.click(screen.getByRole('button', { name: 'weightCard.update' }));

    expect(
      screen.getByRole('heading', { name: 'weightCard.logWeight' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('weightCard.inputLabel')).toHaveValue('60.8');
    expect(screen.getByRole('button', { name: 'saving' })).toBeDisabled();
  });
});
