'use client';

import { createContext, useCallback, useContext, useState } from 'react';

export type AuthTab = 'sign-in' | 'sign-up';

interface AuthDialogContextValue {
  open: boolean;
  tab: AuthTab;
  /** In-app path to return to after auth (e.g. an invite link), or null. */
  next: string | null;
  openDialog: (tab?: AuthTab) => void;
  closeDialog: () => void;
  setTab: (tab: AuthTab) => void;
}

const AuthDialogContext = createContext<AuthDialogContextValue | null>(null);

export function useAuthDialog() {
  const ctx = useContext(AuthDialogContext);
  if (!ctx) {
    throw new Error('useAuthDialog must be used within AuthProvider');
  }
  return ctx;
}

export function AuthProvider({
  children,
  next = null,
  initialOpen = false,
  initialTab = 'sign-in',
}: {
  children: React.ReactNode;
  /** A validated return path (e.g. arriving from an invite link). */
  next?: string | null;
  initialOpen?: boolean;
  initialTab?: AuthTab;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [tab, setTab] = useState<AuthTab>(initialTab);

  const openDialog = useCallback((t: AuthTab = 'sign-up') => {
    setTab(t);
    setOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <AuthDialogContext.Provider
      value={{ open, tab, next, openDialog, closeDialog, setTab }}
    >
      {children}
    </AuthDialogContext.Provider>
  );
}
