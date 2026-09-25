'use client';

import { useTranslations } from 'next-intl';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import { AiConsentDialog } from '@/components/privacy/ai-consent-dialog';
import { setAiProcessingConsent } from '@/lib/actions/privacy/ai-consent';
import type { AiConsentGate } from '@/lib/domain/privacy/consent-gate';

interface AiConsentContextValue {
  /** Whether consent is on record, as far as this page knows. */
  consented: boolean;
  /** The gate the AI entry points hand to their hooks. */
  gate: AiConsentGate;
  /** Settings toggle: record or withdraw consent. Rolls back and rethrows on failure. */
  setConsent: (consented: boolean) => Promise<void>;
}

const AiConsentContext = createContext<AiConsentContextValue | null>(null);

export function useAiConsent() {
  const ctx = useContext(AiConsentContext);
  if (!ctx) {
    throw new Error('useAiConsent must be used within AiConsentProvider');
  }
  return ctx;
}

/**
 * One consent state for the whole signed-in app (App Store 5.1.2(i)).
 *
 * Seeded from the profile the app layout already read, so the first AI action
 * knows without a fetch whether to ask. `gate.ensure()` opens the one-time
 * dialog and resolves with the answer; the caller then proceeds or sends
 * nothing. The server is the authority — a 403 `ai_consent_required` reaches
 * `gate.onRequired()`, which forgets the cached answer and asks again.
 */
export function AiConsentProvider({
  initialConsented,
  children,
}: {
  initialConsented: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations('common.aiConsent');
  const [consented, setConsented] = useState(initialConsented);
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // The pending `ensure()` caller, answered when the dialog closes.
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  // The layout stays mounted across navigations; adopt a fresh server value.
  const [seen, setSeen] = useState(initialConsented);
  if (initialConsented !== seen) {
    setSeen(initialConsented);
    setConsented(initialConsented);
  }

  const settle = useCallback((ok: boolean) => {
    resolverRef.current?.(ok);
    resolverRef.current = null;
  }, []);

  // Open the dialog and resolve with the answer when it closes.
  const ask = useCallback(() => {
    settle(false); // a second ask supersedes an unanswered first one
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, [settle]);

  const ensure = useCallback(
    () => (consented ? Promise.resolve(true) : ask()),
    [consented, ask]
  );

  const onRequired = useCallback(() => {
    setConsented(false);
    return ask();
  }, [ask]);

  const handleContinue = async () => {
    setIsSaving(true);
    try {
      await setAiProcessingConsent(true);
      setConsented(true);
      setOpen(false);
      settle(true);
    } catch (error) {
      console.error('Failed to record AI consent:', error);
      toast.error(t('error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotNow = () => {
    setOpen(false);
    settle(false);
  };

  const setConsent = useCallback(async (next: boolean) => {
    setConsented(next);
    try {
      const { aiProcessingConsentedAt } = await setAiProcessingConsent(next);
      setConsented(aiProcessingConsentedAt !== null);
    } catch (error) {
      setConsented(!next);
      throw error;
    }
  }, []);

  const value = useMemo(
    () => ({ consented, gate: { ensure, onRequired }, setConsent }),
    [consented, ensure, onRequired, setConsent]
  );

  return (
    <AiConsentContext.Provider value={value}>
      {children}
      <AiConsentDialog
        open={open}
        isSaving={isSaving}
        onContinue={handleContinue}
        onNotNow={handleNotNow}
      />
    </AiConsentContext.Provider>
  );
}
