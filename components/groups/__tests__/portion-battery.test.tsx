import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  PortionBattery,
  type PortionSeat,
} from '@/components/groups/share-meal/portion-battery';
import { MIN_PARTS, TOTAL_PARTS } from '@/lib/domain/social/splits/parts';

function seatsFrom(parts: number[]): PortionSeat[] {
  return parts.map((p, i) => ({
    id: `u${i}`,
    initials: i === 0 ? 'B' : `F${i}`,
    label: i === 0 ? 'Bạn' : `Người ${i}`,
    parts: p,
  }));
}

function renderBattery(
  parts: number[],
  opts: { onChange?: (p: number[]) => void; interactive?: boolean } = {}
) {
  return render(
    <PortionBattery
      interactive={opts.interactive ?? true}
      onChange={opts.onChange}
      seats={seatsFrom(parts)}
      totalKcal={1040}
    />
  );
}

describe('PortionBattery — web', () => {
  it('exposes one slider per internal boundary, never on the ends', () => {
    renderBattery([7, 7, 6]);
    // Three people, two seams between them.
    expect(screen.getAllByRole('slider')).toHaveLength(2);
  });

  it('drops the sliders entirely when read-only', () => {
    renderBattery([13, 7], { interactive: false });
    // Gone rather than disabled: the recipient's copy is a picture.
    expect(screen.queryAllByRole('slider')).toHaveLength(0);
  });

  it('announces both neighbours and their parts', () => {
    renderBattery([13, 7]);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute(
      'aria-valuetext',
      'Bạn 13 phần, Người 1 7 phần'
    );
    expect(slider).toHaveAttribute('aria-valuenow', '13');
    expect(slider).toHaveAttribute('aria-valuemin', String(MIN_PARTS));
  });

  it('arrow keys move exactly one part', () => {
    const onChange = vi.fn();
    renderBattery([10, 10], { onChange });

    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith([11, 9]);

    onChange.mockClear();
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith([9, 11]);
  });

  it('shift-arrow jumps five parts', () => {
    const onChange = vi.fn();
    renderBattery([10, 10], { onChange });

    fireEvent.keyDown(screen.getByRole('slider'), {
      key: 'ArrowRight',
      shiftKey: true,
    });
    expect(onChange).toHaveBeenCalledWith([15, 5]);
  });

  it('Home and End clamp to the floor rather than overshooting', () => {
    const onChange = vi.fn();
    renderBattery([10, 10], { onChange });

    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
    expect(onChange).toHaveBeenCalledWith([TOTAL_PARTS - MIN_PARTS, MIN_PARTS]);

    onChange.mockClear();
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith([MIN_PARTS, TOTAL_PARTS - MIN_PARTS]);
  });

  it('reports nothing at all when a step is refused at the floor', () => {
    const onChange = vi.fn();
    // The right run is already at the floor.
    renderBattery([18, 2], { onChange });

    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    // The control simply stops — no no-op change event that would dirty the
    // draft and flip an even split into a hand-shaped one.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('never lets one notch cross another', () => {
    const onChange = vi.fn();
    renderBattery([7, 7, 6], { onChange });

    // Drive the middle boundary hard left; it must stop two parts past the
    // first run rather than inverting it.
    fireEvent.keyDown(screen.getAllByRole('slider')[1], { key: 'Home' });
    const [next] = onChange.mock.calls.at(-1) as [number[]];
    expect(next[0]).toBe(7);
    expect(next[1]).toBe(MIN_PARTS);
    expect(next.reduce((a, b) => a + b, 0)).toBe(TOTAL_PARTS);
  });

  it('gives every seat but the first a remove control', () => {
    const onRemove = vi.fn();
    render(
      <PortionBattery
        onRemove={onRemove}
        seats={seatsFrom([7, 7, 6])}
        totalKcal={1040}
      />
    );
    // You cannot remove yourself.
    const buttons = screen.getAllByRole('button', { name: /^Bỏ / });
    expect(buttons).toHaveLength(2);

    fireEvent.click(buttons[0]);
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it('splits the dish calories across the runs it draws', () => {
    renderBattery([13, 7]);
    // 1040 kcal over 20 parts: 13 parts is 676, 7 is 364.
    expect(screen.getByText('676')).toBeInTheDocument();
    expect(screen.getByText('364')).toBeInTheDocument();
  });
});
