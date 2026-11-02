'use client';

import { useEffect } from 'react';
import { clearComposerDrafts } from '@/lib/domain/logging/drafts/composer-drafts';
import { createClient } from '@/lib/infra/supabase/client';

/** Also purge this tab's drafts when another tab signs the account out. */
export function ComposerDraftSession() {
  useEffect(() => {
    // auth-js also emits SIGNED_OUT when it drops a stale stored session on a
    // signed-out page; only an account this document held is an exit.
    let hadSession = false;
    const {
      data: { subscription },
    } = createClient().auth.onAuthStateChange((event, session) => {
      if (session) hadSession = true;
      if (event !== 'SIGNED_OUT' || !hadSession) return;
      clearComposerDrafts();
      // Drop live composer state too, and let the next sign-in start with a
      // fresh document whose draft persistence is enabled.
      window.location.assign('/');
    });
    return () => subscription.unsubscribe();
  }, []);
  return null;
}
