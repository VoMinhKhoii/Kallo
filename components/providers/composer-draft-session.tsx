'use client';

import { useEffect } from 'react';
import { clearComposerDrafts } from '@/lib/domain/logging/drafts/composer-drafts';
import { createClient } from '@/lib/infra/supabase/client';

/** Also purge this tab's drafts when another tab signs the account out. */
export function ComposerDraftSession() {
  useEffect(() => {
    const {
      data: { subscription },
    } = createClient().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') clearComposerDrafts();
    });
    return () => subscription.unsubscribe();
  }, []);
  return null;
}
