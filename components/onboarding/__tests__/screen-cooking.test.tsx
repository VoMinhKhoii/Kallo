import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScreenCooking } from '../screen-cooking';

describe('ScreenCooking', () => {
  it('renders restored cooking hints for option strips and sugar helper copy', async () => {
    render(<ScreenCooking defaultValues={{}} onChange={vi.fn()} />);

    expect(
      await screen.findByText('cooking.oilMinimalHint')
    ).toBeInTheDocument();
    expect(screen.getByText('cooking.riceMediumHint')).toBeInTheDocument();
    expect(screen.getByText('cooking.sugarHint')).toBeInTheDocument();
    expect(screen.getByText('cooking.proteinLargeHint')).toBeInTheDocument();
    expect(screen.getByText('cooking.brothSomeHint')).toBeInTheDocument();
  });
});
