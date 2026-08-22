/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FeedbackListRow } from '@/lib/admin/queries/feedback';
import { FeedbackTable } from '../feedback-table';

function row(over: Partial<FeedbackListRow> = {}): FeedbackListRow {
  return {
    id: 'fb-1',
    type: 'bug',
    status: 'open',
    message: 'the macro card is blank',
    platform: 'ios',
    locale: 'vi',
    screenshotPath: null,
    createdAt: new Date('2026-08-17T09:30:15Z'),
    ...over,
  } as FeedbackListRow;
}

describe('FeedbackTable', () => {
  it('renders an empty notice instead of a table when there are no rows', () => {
    render(<FeedbackTable rows={[]} />);
    expect(screen.getByText('No feedback found.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('links the message to the detail route', () => {
    render(<FeedbackTable rows={[row()]} />);
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/admin/feedback/fb-1'
    );
  });

  it('renders a formatted UTC timestamp', () => {
    render(<FeedbackTable rows={[row()]} />);
    expect(screen.getByText('2026-08-17 09:30:15 UTC')).toBeInTheDocument();
  });

  it('joins platform and locale, and falls back to an em dash', () => {
    const { unmount } = render(<FeedbackTable rows={[row()]} />);
    expect(screen.getByText('ios · vi')).toBeInTheDocument();
    unmount();

    render(<FeedbackTable rows={[row({ platform: null, locale: null })]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('truncates the message at 90 characters', () => {
    const long = 'z'.repeat(120);
    render(<FeedbackTable rows={[row({ message: long })]} />);
    expect(screen.getByText(`${'z'.repeat(90)}…`)).toBeInTheDocument();
  });

  it('shows a paperclip only when a screenshot is attached', () => {
    const { unmount } = render(<FeedbackTable rows={[row()]} />);
    expect(screen.queryByLabelText('Has screenshot')).not.toBeInTheDocument();
    unmount();

    render(<FeedbackTable rows={[row({ screenshotPath: 'a/b.png' })]} />);
    expect(screen.getByLabelText('Has screenshot')).toBeInTheDocument();
  });

  it('falls back to the raw value for an unknown type or status', () => {
    render(
      <FeedbackTable rows={[row({ type: 'mystery', status: 'weird' })]} />
    );
    expect(screen.getByText('mystery')).toBeInTheDocument();
    expect(screen.getByText('weird')).toBeInTheDocument();
  });
});
