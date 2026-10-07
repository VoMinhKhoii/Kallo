import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MacroDial } from '../macro-dial';

function renderDial(atLeast?: boolean) {
  return render(
    <MacroDial
      atLeast={atLeast}
      current={42.4}
      dialKey="protein"
      label="Protein"
      radius={44}
      target={140}
    />
  );
}

describe('MacroDial', () => {
  it('shows the grams eaten over the target', () => {
    renderDial();
    expect(screen.getByText('42g')).toBeInTheDocument();
    expect(screen.getByText('/140g')).toBeInTheDocument();
  });

  it('marks a total missing a meal’s value as a floor', () => {
    renderDial(true);
    expect(screen.getByText('≥42g')).toBeInTheDocument();
  });
});
