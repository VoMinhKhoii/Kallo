import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuthDialog } from '@/components/auth/auth-provider';
import { ApplyAuthRequestConfig } from '../apply-auth-request-config';
import { authIntent } from '../auth-request-config';

vi.mock('next/server', () => ({ connection: async () => undefined }));

describe('authIntent', () => {
  it('opens nothing for a plain landing visit', () => {
    expect(authIntent({})).toEqual({ next: null, openTab: null });
  });

  it('opens the requested tab', () => {
    expect(authIntent({ auth: 'sign-in' }).openTab).toBe('sign-in');
    expect(authIntent({ auth: 'sign-up' }).openTab).toBe('sign-up');
  });

  // Invite recipients usually have no account yet.
  it('opens sign-up for an invite return path', () => {
    expect(authIntent({ next: '/vi/invite/khoi' })).toEqual({
      next: '/vi/invite/khoi',
      openTab: 'sign-up',
    });
  });

  it('drops a return path that could leave the app', () => {
    expect(authIntent({ next: '//evil.example' })).toEqual({
      next: null,
      openTab: null,
    });
  });
});

let openByHand: (() => void) | undefined;

function Probe() {
  const { open, tab, next, googleClientId, openDialog } = useAuthDialog();
  openByHand = () => openDialog('sign-in');
  return <output>{JSON.stringify({ open, tab, next, googleClientId })}</output>;
}

function state() {
  return JSON.parse(screen.getByRole('status').textContent ?? '{}');
}

// The prerendered page knows none of these; they stream in after the shell.
describe('ApplyAuthRequestConfig', () => {
  it('hands the runtime Google client ID to the provider', () => {
    render(
      <AuthProvider>
        <ApplyAuthRequestConfig googleClientId="web-client-id" />
        <Probe />
      </AuthProvider>
    );

    expect(state()).toMatchObject({
      googleClientId: 'web-client-id',
      open: false,
      next: null,
    });
  });

  it('opens the dialog on the invite intent it was given', () => {
    render(
      <AuthProvider>
        <ApplyAuthRequestConfig
          googleClientId={null}
          next="/en/invite/khoi"
          openTab="sign-up"
        />
        <Probe />
      </AuthProvider>
    );

    expect(state()).toMatchObject({
      open: true,
      tab: 'sign-up',
      next: '/en/invite/khoi',
    });
  });

  it('keeps a return path the provider was created with', () => {
    render(
      <AuthProvider next="/en/invite/khoi">
        <ApplyAuthRequestConfig googleClientId="id" />
        <Probe />
      </AuthProvider>
    );

    expect(state().next).toBe('/en/invite/khoi');
  });

  // The page is kept alive across `/en?auth=sign-in` → `/en` (history or a
  // link), so the provider sees the intent go away rather than remounting.
  it('closes a dialog the URL opened once the URL drops the intent', () => {
    const page = (openTab: 'sign-in' | null) => (
      <AuthProvider>
        <ApplyAuthRequestConfig googleClientId="id" openTab={openTab} />
        <Probe />
      </AuthProvider>
    );
    const view = render(page('sign-in'));
    expect(state().open).toBe(true);

    view.rerender(page(null));

    expect(state().open).toBe(false);
  });

  it('leaves a dialog the reader opened alone', () => {
    const page = (googleClientId: string) => (
      <AuthProvider>
        <ApplyAuthRequestConfig
          googleClientId={googleClientId}
          openTab={null}
        />
        <Probe />
      </AuthProvider>
    );
    const view = render(page('id'));
    act(() => openByHand?.());
    expect(state().open).toBe(true);

    // A later request-time update with no intent must not shut it.
    view.rerender(page('id-2'));

    expect(state()).toMatchObject({ open: true, googleClientId: 'id-2' });
  });
});
