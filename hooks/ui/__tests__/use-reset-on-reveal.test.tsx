import { render } from '@testing-library/react';
import { Activity } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useResetOnReveal } from '../use-reset-on-reveal';

function Probe({
  reset,
  label,
}: {
  reset: (label: string) => void;
  label: string;
}) {
  useResetOnReveal(() => reset(label));
  return null;
}

function Page({
  mode,
  reset,
  label = 'first',
}: {
  mode: 'visible' | 'hidden';
  reset: (label: string) => void;
  label?: string;
}) {
  return (
    <Activity mode={mode}>
      <Probe reset={reset} label={label} />
    </Activity>
  );
}

describe('useResetOnReveal', () => {
  it('does not run on the first mount', () => {
    const reset = vi.fn();
    render(<Page mode="visible" reset={reset} />);
    expect(reset).not.toHaveBeenCalled();
  });

  it('does not run on hide, only when shown again', () => {
    const reset = vi.fn();
    const view = render(<Page mode="visible" reset={reset} />);

    view.rerender(<Page mode="hidden" reset={reset} />);
    expect(reset).not.toHaveBeenCalled();

    view.rerender(<Page mode="visible" reset={reset} />);
    expect(reset).toHaveBeenCalledOnce();
  });

  it('runs on every reveal with the latest render', () => {
    const reset = vi.fn();
    const view = render(<Page mode="visible" reset={reset} />);

    view.rerender(<Page mode="hidden" reset={reset} label="while hidden" />);
    view.rerender(<Page mode="visible" reset={reset} label="while hidden" />);
    view.rerender(<Page mode="hidden" reset={reset} label="again" />);
    view.rerender(<Page mode="visible" reset={reset} label="again" />);

    expect(reset.mock.calls).toEqual([['while hidden'], ['again']]);
  });
});
