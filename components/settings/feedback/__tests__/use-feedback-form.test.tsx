import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Activity } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackPanel } from '../feedback-panel';
import { useFeedbackForm } from '../use-feedback-form';

/**
 * Cache Components hides a page with React <Activity> on navigation instead of
 * unmounting it, so state survives. These pin what should and should not.
 */

let form: ReturnType<typeof useFeedbackForm>;

function Harness() {
  form = useFeedbackForm();
  return <p>{form.sent ? 'sent' : `draft:${form.message}`}</p>;
}

function Page({ mode }: { mode: 'visible' | 'hidden' }) {
  return (
    <Activity mode={mode}>
      <Harness />
    </Activity>
  );
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 201 }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useFeedbackForm across a kept-alive navigation', () => {
  it('keeps an unsent draft', async () => {
    const view = render(<Page mode="visible" />);
    act(() => form.setMessage('the barcode scanner froze'));

    view.rerender(<Page mode="hidden" />);
    view.rerender(<Page mode="visible" />);

    expect(screen.getByText('draft:the barcode scanner froze')).toBeTruthy();
  });

  it('drops the confirmation for a message already sent', async () => {
    const view = render(<Page mode="visible" />);
    act(() => form.setMessage('the barcode scanner froze'));
    await act(() => form.handleSubmit());
    expect(screen.getByText('sent')).toBeTruthy();

    view.rerender(<Page mode="hidden" />);
    view.rerender(<Page mode="visible" />);

    expect(screen.getByText('draft:')).toBeTruthy();
  });

  // The same screenshot must still attach to the next report: a native file
  // input that kept the old FileList would fire no `change` for it.
  it('attaches the same screenshot again to the next report', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    const shot = new File(['png'], 'bug.png', { type: 'image/png' });
    const panel = (mode: 'visible' | 'hidden') => (
      <Activity mode={mode}>
        <FeedbackPanel />
      </Activity>
    );
    const fileInput = () =>
      document.querySelector<HTMLInputElement>('input[type="file"]');

    const view = render(panel('visible'));
    await user.type(screen.getByRole('textbox'), 'first');
    await user.upload(fileInput() as HTMLInputElement, shot);
    await user.click(screen.getByRole('button', { name: 'submit' }));
    expect(await screen.findByText('successTitle')).toBeTruthy();

    view.rerender(panel('hidden'));
    view.rerender(panel('visible'));

    expect(fileInput()?.files).toHaveLength(0);
    fetchMock.mockClear();
    await user.type(screen.getByRole('textbox'), 'second');
    await user.upload(fileInput() as HTMLInputElement, shot);
    await user.click(screen.getByRole('button', { name: 'submit' }));

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toContain('/api/v1/feedback/screenshot');
  });
});
