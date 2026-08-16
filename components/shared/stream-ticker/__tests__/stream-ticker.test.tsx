import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreamTickerFrame } from '@/components/shared/stream-ticker/stream-ticker-frame';
import { deriveStreamTicker } from '@/components/shared/stream-ticker/stream-ticker-frame';
import type { MealItem } from '@/lib/types/meal';

// The global setup mock carries no messages, so `t.has` is false everywhere and
// every stage would fall back to its flat label — which is exactly the branch
// this file is NOT about. Stand up a mock with real verb arrays instead.
const MESSAGES: Record<string, string | string[]> = {
  'verbs.prefix': 'Đang',
  'verbs.decomposing': ['sơ chế…', 'bóc tách…'],
  'verbs.estimating': ['tính toán…'],
  decomposing: 'Đang tách bữa ăn của bạn…',
  matching: 'Đang khớp nguyên liệu…',
};

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => {
      const value = MESSAGES[key];
      return typeof value === 'string' ? value : key;
    };
    t.raw = (key: string) => MESSAGES[key];
    t.has = (key: string) => key in MESSAGES;
    t.rich = t;
    return t;
  },
  useLocale: () => 'vi',
}));

// The loader draws to a canvas jsdom does not implement; it is decorative and
// nothing here asserts on it.
vi.mock('@/components/shared/loaders/canvas-loader', () => ({
  CanvasLoader: () => null,
}));

// `AnimatePresence mode="wait"` holds the outgoing line until its exit finishes,
// and this file runs on fake timers, so nothing would ever swap in. These tests
// are about WHAT the line says and WHEN — the 180ms flip is not under test.
vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    span: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <span {...props}>{children}</span>
    ),
  },
  useReducedMotion: () => false,
}));

const { StreamTicker } = await import(
  '@/components/shared/stream-ticker/stream-ticker'
);

function macros(calories: number) {
  return { calories, protein: 0, carbs: 0, fat: 0 };
}

const DISH: MealItem = {
  id: 'i1',
  name: 'Phở bò',
  quantity: 1,
  unit: 'bát',
  macros: macros(480),
} as MealItem;

function phaseFrame(stage: string): StreamTickerFrame {
  return { key: `phase-${stage}`, kind: 'phase', text: '', stage };
}

describe('the streaming ticker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('opens on the stage first, most literal verb', () => {
    render(<StreamTicker frame={phaseFrame('decomposing')} loaderIndex={0} />);
    expect(screen.getByText('sơ chế…')).toBeInTheDocument();
  });

  it('holds the shared opener still while the rest of the line flips', () => {
    render(<StreamTicker frame={phaseFrame('decomposing')} loaderIndex={0} />);
    // "Đang" is its own node, outside the animated span — re-animating the word
    // every rotation was wasted motion.
    expect(screen.getByText('Đang')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2400);
    });
    expect(screen.getByText('bóc tách…')).toBeInTheDocument();
    expect(screen.getByText('Đang')).toBeInTheDocument();
  });

  it('cycles through the stage verbs and wraps', () => {
    render(<StreamTicker frame={phaseFrame('decomposing')} loaderIndex={0} />);
    act(() => {
      vi.advanceTimersByTime(2400);
    });
    expect(screen.getByText('bóc tách…')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2400);
    });
    expect(screen.getByText('sơ chế…')).toBeInTheDocument();
  });

  it('a new stage opens its own set rather than continuing the last rotation', () => {
    const view = render(
      <StreamTicker frame={phaseFrame('decomposing')} loaderIndex={0} />
    );
    act(() => {
      vi.advanceTimersByTime(2400);
    });
    expect(screen.getByText('bóc tách…')).toBeInTheDocument();

    view.rerender(
      <StreamTicker frame={phaseFrame('estimating')} loaderIndex={0} />
    );
    expect(screen.getByText('tính toán…')).toBeInTheDocument();
  });

  it('a dish takes the line, then hands it back to the stage verbs', () => {
    const view = render(
      <StreamTicker frame={phaseFrame('decomposing')} loaderIndex={0} />
    );

    // A dish landing is the only genuinely new information on screen.
    view.rerender(
      <StreamTicker
        frame={deriveStreamTicker({
          isAnalyzing: true,
          status: 'decomposing',
          items: [],
          completedItems: [DISH],
        })}
        loaderIndex={0}
      />
    );
    expect(screen.getByText('Phở bò')).toBeInTheDocument();
    expect(screen.getByText('· 480 kcal')).toBeInTheDocument();
    // A dish is the meal's own words — the app's opener does not belong here.
    expect(screen.queryByText('Đang')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2400);
    });
    // Back to the stage's verbs. Without this the first dish detected during
    // decomposing would hold the line for the rest of the run.
    expect(screen.queryByText('Phở bò')).not.toBeInTheDocument();
    expect(screen.getByText('sơ chế…')).toBeInTheDocument();
  });

  it('falls back to the flat label for a stage the locale has no verbs for', () => {
    render(<StreamTicker frame={phaseFrame('matching')} loaderIndex={0} />);
    // A bad l10n edit degrades to the previous copy, never to a raw key path,
    // and the flat label is a whole sentence so it takes no opener.
    expect(screen.getByText('Đang khớp nguyên liệu…')).toBeInTheDocument();
    expect(screen.queryByText('Đang')).not.toBeInTheDocument();
  });
});
