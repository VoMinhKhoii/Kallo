import { act, render, screen } from '@testing-library/react';
import { Activity } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
});
