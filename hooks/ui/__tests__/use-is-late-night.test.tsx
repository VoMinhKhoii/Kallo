import { renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIsLateNight } from '@/hooks/ui/use-is-late-night';

function Probe() {
  return <span>{useIsLateNight() ? 'night' : 'day'}</span>;
}

describe('useIsLateNight', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is true after 22:00', () => {
    vi.setSystemTime(new Date(2026, 0, 15, 23, 0, 0));

    expect(renderHook(() => useIsLateNight()).result.current).toBe(true);
  });

  it('is false in the middle of the day', () => {
    vi.setSystemTime(new Date(2026, 0, 15, 12, 0, 0));

    expect(renderHook(() => useIsLateNight()).result.current).toBe(false);
  });

  it('renders the daytime value on the server, whatever the clock says', () => {
    // The server has no business guessing the viewer's clock: it renders the
    // awake pose and the client corrects it on the first commit.
    vi.setSystemTime(new Date(2026, 0, 15, 23, 0, 0));

    expect(renderToString(<Probe />)).toContain('day');
  });
});
