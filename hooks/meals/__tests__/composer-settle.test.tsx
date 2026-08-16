import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSettledOnce } from '@/hooks/meals/use-settled-once';

// The real hook `useFeedController` reads for `animateComposerLayout`, driven
// directly: standing up the whole feed would want a query client, a stream, a
// profile and a composer ref to assert one boolean.
const useAnimateComposerLayout = useSettledOnce;

describe('the composer layout spring', () => {
  it('stays off through the render that resolves the day', () => {
    const { result, rerender } = renderHook(
      ({ loading }: { loading: boolean }) => useAnimateComposerLayout(loading),
      { initialProps: { loading: true } }
    );
    expect(result.current).toBe(false);

    // The day answers. THIS render is the one that moves the composer from the
    // bottom to the centre on an empty day — springing it here is what sent the
    // bar flying up the screen on every cold load.
    rerender({ loading: false });
    expect(result.current).toBe(false);
  });

  it('turns on for every render after that', () => {
    const { result, rerender } = renderHook(
      ({ loading }: { loading: boolean }) => useAnimateComposerLayout(loading),
      { initialProps: { loading: true } }
    );
    rerender({ loading: false });
    rerender({ loading: false });

    // Because the bar gliding down as the user's first meal card takes the
    // space is the animation this prop exists for.
    expect(result.current).toBe(true);
  });

  it('stays on once settled, even if the day goes loading again', () => {
    const { result, rerender } = renderHook(
      ({ loading }: { loading: boolean }) => useAnimateComposerLayout(loading),
      { initialProps: { loading: false } }
    );
    rerender({ loading: true });
    // A refetch is not a cold load: the composer is already where it belongs,
    // and anything that moves it from here is a real change worth animating.
    expect(result.current).toBe(true);
  });
});
