import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PartialDayNotice } from '../partial-day-notice';

describe('PartialDayNotice', () => {
  it('renders an informational status callout with title and body', () => {
    render(<PartialDayNotice calories={400} target={2000} />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });
});
