import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DecimalInput } from '@/components/shared/decimal-input';

function Harness({
  onValue,
  initial,
  integer,
}: {
  onValue?: (v: number | undefined) => void;
  initial?: number;
  integer?: boolean;
}) {
  const [value, setValue] = useState<number | undefined>(initial);
  return (
    <DecimalInput
      aria-label="weight"
      integer={integer}
      value={value}
      onValueChange={(v) => {
        setValue(v);
        onValue?.(v);
      }}
    />
  );
}

describe('DecimalInput', () => {
  it('preserves a comma decimal separator while typing (iOS keyboard)', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);

    const input = screen.getByLabelText<HTMLInputElement>('weight');
    await user.type(input, '65,3');

    // The raw text the user typed must survive every controlled re-render.
    expect(input.value).toBe('65,3');
    // ...and the value reported upstream is the normalized number.
    expect(onValue).toHaveBeenLastCalledWith(65.3);
  });

  it('keeps an in-progress trailing separator visible', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByLabelText<HTMLInputElement>('weight');
    await user.type(input, '65.');

    expect(input.value).toBe('65.');
  });

  it('reports undefined when the field is cleared', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} initial={70} />);

    const input = screen.getByLabelText<HTMLInputElement>('weight');
    await user.clear(input);

    expect(input.value).toBe('');
    expect(onValue).toHaveBeenLastCalledWith(undefined);
  });

  it('normalizes a comma entry to canonical form on blur', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Harness />
        <button type="button">elsewhere</button>
      </>
    );

    const input = screen.getByLabelText<HTMLInputElement>('weight');
    await user.type(input, '65,3');
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));

    expect(input.value).toBe('65.3');
  });

  it('truncates decimals to an integer in integer mode', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(
      <>
        <Harness integer onValue={onValue} />
        <button type="button">elsewhere</button>
      </>
    );

    const input = screen.getByLabelText<HTMLInputElement>('weight');
    await user.type(input, '170.5');
    expect(onValue).toHaveBeenLastCalledWith(170);

    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(input.value).toBe('170');
  });

  it('syncs an external value change into the displayed text', () => {
    const { rerender } = render(
      <DecimalInput aria-label="weight" value={70} onValueChange={vi.fn()} />
    );
    const input = screen.getByLabelText<HTMLInputElement>('weight');
    expect(input.value).toBe('70');

    rerender(
      <DecimalInput aria-label="weight" value={65} onValueChange={vi.fn()} />
    );
    expect(input.value).toBe('65');
  });
});
