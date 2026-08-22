/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { JsonViewer } from '../json-viewer';

describe('JsonViewer', () => {
  it('renders an "empty" line instead of a toggle for null and undefined', () => {
    const { unmount } = render(<JsonViewer label="Input" value={null} />);
    expect(screen.getByText('Input:')).toBeInTheDocument();
    expect(screen.getByText('empty')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    unmount();

    render(<JsonViewer label="Input" value={undefined} />);
    expect(screen.getByText('empty')).toBeInTheDocument();
  });

  it('starts collapsed and shows a 60-character preview', () => {
    const value = { note: 'y'.repeat(200) };
    render(<JsonViewer label="Output" value={value} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).not.toHaveAttribute('aria-controls');
    // The preview and its ellipsis are separate text nodes.
    const formatted = JSON.stringify(value, null, 2);
    expect(button.textContent).toBe(`Output${formatted.slice(0, 60)}…`);
  });

  it('omits the ellipsis when the payload is shorter than the preview', () => {
    render(<JsonViewer label="Output" value={1} />);
    expect(screen.getByRole('button').textContent).toBe('Output1');
  });

  it('expands to pretty-printed JSON on click and wires aria-controls', async () => {
    const { container } = render(
      <JsonViewer label="Output" value={{ a: 1, b: [2, 3] }} />
    );
    await userEvent.click(screen.getByRole('button'));

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toBe(JSON.stringify({ a: 1, b: [2, 3] }, null, 2));
    expect(button.getAttribute('aria-controls')).toBe(pre?.id);
  });

  it('honors defaultOpen', () => {
    const { container } = render(
      <JsonViewer label="Output" value={{ a: 1 }} defaultOpen />
    );
    expect(container.querySelector('pre')).not.toBeNull();
  });

  it('collapses again on a second click', async () => {
    const { container } = render(
      <JsonViewer label="Output" value={{ a: 1 }} defaultOpen />
    );
    await userEvent.click(screen.getByRole('button'));
    expect(container.querySelector('pre')).toBeNull();
  });
});
