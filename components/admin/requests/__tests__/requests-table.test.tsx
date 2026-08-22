/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RequestListRow } from '@/lib/admin/queries/requests';
import { RequestsTable } from '../requests-table';

function row(over: Partial<RequestListRow> = {}): RequestListRow {
  return {
    id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    status: 'success',
    durationMs: 1234,
    rawInput: 'phở bò tái',
    createdAt: new Date('2026-08-17T09:30:15Z'),
    replayOfRequestId: null,
    ...over,
  } as RequestListRow;
}

describe('RequestsTable', () => {
  it('renders an empty notice instead of a table when there are no rows', () => {
    render(<RequestsTable rows={[]} />);
    expect(screen.getByText('No requests found.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('links the row by its first 8 id characters', () => {
    render(<RequestsTable rows={[row()]} />);
    const link = screen.getByRole('link', { name: 'aaaaaaaa…' });
    expect(link).toHaveAttribute(
      'href',
      '/admin/requests/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
    );
  });

  it('renders the status and a formatted UTC timestamp', () => {
    render(<RequestsTable rows={[row()]} />);
    expect(screen.getByText('success')).toBeInTheDocument();
    expect(screen.getByText('2026-08-17 09:30:15 UTC')).toBeInTheDocument();
  });

  it('renders a duration in ms, or an em dash when it is missing', () => {
    const { container, unmount } = render(<RequestsTable rows={[row()]} />);
    const cells = () => container.querySelectorAll('tbody td');
    expect(cells()[2]).toHaveTextContent('1234 ms');
    unmount();

    const missing = render(
      <RequestsTable rows={[row({ durationMs: null })]} />
    );
    expect(missing.container.querySelectorAll('tbody td')[2]).toHaveTextContent(
      '—'
    );
  });

  it('truncates the input preview at 80 characters with an ellipsis', () => {
    const long = 'x'.repeat(100);
    render(<RequestsTable rows={[row({ rawInput: long })]} />);
    expect(screen.getByText(`${'x'.repeat(80)}…`)).toBeInTheDocument();
  });

  it('leaves a short input preview unsuffixed', () => {
    render(<RequestsTable rows={[row({ rawInput: 'short' })]} />);
    expect(screen.getByText('short')).toBeInTheDocument();
  });

  it('links the original request when the row is a replay', () => {
    render(
      <RequestsTable
        rows={[
          row({ replayOfRequestId: '99999999-1111-4111-a111-111111111111' }),
        ]}
      />
    );
    expect(screen.getByRole('link', { name: '99999999…' })).toHaveAttribute(
      'href',
      '/admin/requests/99999999-1111-4111-a111-111111111111'
    );
  });
});
