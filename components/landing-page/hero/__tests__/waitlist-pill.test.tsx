import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Activity, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WaitlistPill } from '../waitlist-pill';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function renderForm(source: 'hero' | 'cta' = 'hero') {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<WaitlistPill source={source} />, { wrapper });
}

/** next-intl is globally mocked to echo keys, so labels are the key names. */
const EMAIL_FIELD = 'placeholder';
const SUBMIT = 'submit';

describe('WaitlistPill', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  });

  it('posts the address and swaps in the check-your-inbox state', async () => {
    renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(EMAIL_FIELD), 'a@b.co');
    await user.click(screen.getByRole('button', { name: /submit/ }));

    await waitFor(() => {
      expect(screen.getByText('success')).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/waitlist',
      expect.objectContaining({ method: 'POST' })
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: 'a@b.co',
      locale: 'en',
      source: 'hero',
    });
    expect(screen.queryByPlaceholderText(EMAIL_FIELD)).not.toBeInTheDocument();
  });

  it('blocks submit on an invalid address without calling the API', async () => {
    renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(EMAIL_FIELD), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /submit/ }));

    await waitFor(() => {
      expect(screen.getByText('invalidEmail')).toBeInTheDocument();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('associates the validation message with the input for screen readers', async () => {
    renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(EMAIL_FIELD), 'nope');
    await user.click(screen.getByRole('button', { name: /submit/ }));

    await waitFor(() => {
      const input = screen.getByPlaceholderText(EMAIL_FIELD);
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAccessibleDescription('invalidEmail');
    });
  });

  it('shows a distinct message when the request is rate limited', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: { code: 'RATE_LIMITED', status: 429, retryable: true },
      }),
    });
    renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(EMAIL_FIELD), 'a@b.co');
    await user.click(screen.getByRole('button', { name: new RegExp(SUBMIT) }));

    await waitFor(() => {
      expect(screen.getByText('rateLimited')).toBeInTheDocument();
    });
    // The form stays up so the visitor can retry.
    expect(screen.getByPlaceholderText(EMAIL_FIELD)).toBeInTheDocument();
  });

  it('shows a generic message for any other failure', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => null });
    renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(EMAIL_FIELD), 'a@b.co');
    await user.click(screen.getByRole('button', { name: new RegExp(SUBMIT) }));

    await waitFor(() => {
      expect(screen.getByText('error')).toBeInTheDocument();
    });
  });
});

describe('WaitlistPill source', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  });

  it('tags the closing pill as cta and gives it its own field id', async () => {
    renderForm('cta');
    const user = userEvent.setup();

    const input = screen.getByPlaceholderText(EMAIL_FIELD);
    expect(input).toHaveAttribute('id', 'cta-waitlist-email');
    await user.type(input, 'a@b.co');
    await user.click(screen.getByRole('button', { name: /submit/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).source).toBe('cta');
  });
});

describe('WaitlistPill across navigation', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  });

  // Cache Components hides the landing page with <Activity> on navigation
  // instead of unmounting it. Coming back must show the form again, not the
  // last visit's "check your inbox".
  it('clears the check-your-inbox state when the page is shown again', async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const page = (mode: 'visible' | 'hidden') => (
      <QueryClientProvider client={client}>
        <Activity mode={mode}>
          <WaitlistPill source="hero" />
        </Activity>
      </QueryClientProvider>
    );
    const view = render(page('visible'));
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(EMAIL_FIELD), 'a@b.co');
    await user.click(screen.getByRole('button', { name: /submit/ }));
    expect(await screen.findByText('success')).toBeInTheDocument();

    view.rerender(page('hidden'));
    view.rerender(page('visible'));

    expect(screen.queryByText('success')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(EMAIL_FIELD)).toBeInTheDocument();
  });
});
