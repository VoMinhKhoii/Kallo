import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SurfaceState } from '@/components/shared/surface-state/surface-state';
import { CIRCLE_CAST } from '@/lib/brand/illustrations/casts/circle';
import { SYSTEM_CAST } from '@/lib/brand/illustrations/casts/system';

const DAYTIME = new Date(2026, 0, 15, 12, 0, 0);
const LATE_NIGHT = new Date(2026, 0, 15, 23, 0, 0);

function illustration(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('the surface state drew no illustration');
  return svg as SVGSVGElement;
}

describe('SurfaceState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(DAYTIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('says what happened, why, and what to do about it', () => {
    render(
      <SurfaceState
        action={<button type="button">Try again</button>}
        cast={CIRCLE_CAST}
        kind="error"
        subtitle="Something went wrong on our side."
        title="This didn't load."
      />
    );

    expect(screen.getByText("This didn't load.")).toBeInTheDocument();
    expect(
      screen.getByText('Something went wrong on our side.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Try again' })
    ).toBeInTheDocument();
  });

  it('announces an error, and only an error', () => {
    const { unmount } = render(
      <SurfaceState cast={CIRCLE_CAST} kind="error" title="This didn't load." />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    unmount();

    render(
      <SurfaceState cast={CIRCLE_CAST} kind="empty" title="Nothing yet" />
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('hides the illustration from assistive tech', () => {
    const { container } = render(
      <SurfaceState cast={CIRCLE_CAST} kind="error" title="This didn't load." />
    );

    expect(illustration(container)).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws the awake pose during the day', () => {
    const { container } = render(
      <SurfaceState cast={CIRCLE_CAST} kind="error" title="This didn't load." />
    );

    expect(illustration(container)).toHaveAttribute(
      'data-illustration',
      'capybara-stuck-jar'
    );
  });

  it('puts the animal to bed after 22:00', () => {
    vi.setSystemTime(LATE_NIGHT);

    const { container } = render(
      <SurfaceState cast={CIRCLE_CAST} kind="error" title="This didn't load." />
    );

    expect(illustration(container)).toHaveAttribute(
      'data-illustration',
      'capybara-sleeping-hammock'
    );
  });

  it('shrinks the art in a card', () => {
    const { container } = render(
      <SurfaceState
        cast={CIRCLE_CAST}
        compact
        kind="empty"
        title="Nothing yet"
      />
    );

    expect(illustration(container)).toHaveClass('h-16');
  });

  it('draws the art full height on a whole surface', () => {
    const { container } = render(
      <SurfaceState cast={CIRCLE_CAST} kind="empty" title="Nothing yet" />
    );

    expect(illustration(container)).toHaveClass('h-[120px]');
  });

  it('lets a page own its heading level', () => {
    render(
      <SurfaceState
        as="h1"
        cast={SYSTEM_CAST}
        kind="notFound"
        title="Not found"
      />
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Not found' })
    ).toBeInTheDocument();
  });
});
