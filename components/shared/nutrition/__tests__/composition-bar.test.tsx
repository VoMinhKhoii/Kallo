import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// The segments animate their width in; these tests are about the shape they
// settle into, not the 0.6s it takes.
vi.mock('motion/react', () => ({
  motion: {
    span: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <span {...props}>{children}</span>
    ),
  },
}));

const { CompositionBar } = await import(
  '@/components/shared/nutrition/composition-bar'
);

const SEGMENTS = [
  { key: 'protein' as const, pct: 40 },
  { key: 'carbohydrate' as const, pct: 45 },
  { key: 'fat' as const, pct: 15 },
];

describe('CompositionBar', () => {
  it('gaps the full bar over its track, every segment rounded', () => {
    const { container } = render(<CompositionBar segments={SEGMENTS} />);

    const bar = container.firstElementChild;
    expect(bar).toHaveClass('gap-0.5', 'bg-kallo-track');
    expect(bar?.children).toHaveLength(3);
    for (const segment of Array.from(bar?.children ?? [])) {
      expect(segment).toHaveClass('rounded-full');
    }
  });

  it('leaves the compact bar as it was', () => {
    const { container } = render(
      <CompositionBar segments={SEGMENTS} variant="compact" />
    );

    const bar = container.firstElementChild;
    expect(bar).toHaveClass('h-1.5', 'gap-0.5');
    expect(bar).not.toHaveClass('bg-kallo-track');
  });

  it('drops a macro that measured zero rather than drawing a seam', () => {
    const { container } = render(
      <CompositionBar
        segments={[...SEGMENTS.slice(0, 2), { key: 'fat' as const, pct: 0 }]}
      />
    );

    expect(container.firstElementChild?.children).toHaveLength(2);
  });
});
