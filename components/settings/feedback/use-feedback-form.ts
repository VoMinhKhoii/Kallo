'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from '@/i18n/navigation';
import type {
  FEEDBACK_TYPES,
  SubmitFeedbackInput,
} from '@/lib/api/contracts/feedback';

type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const MAX_LENGTH = 4000;
export const MAX_BYTES = 5 * 1024 * 1024;
export const ACCEPTED = 'image/png,image/jpeg,image/webp';

/**
 * All feedback-form state and side effects, extracted from FeedbackPanel so the
 * presentation stays thin. Behavior — the `/api/v1/feedback*` fetch calls, the
 * uploaded-screenshot cache (no orphan re-uploads on retry), rate-limit mapping,
 * size/length limits, type-retaining reset, and success focus — is preserved
 * verbatim from the original panel.
 */
export function useFeedbackForm() {
  const t = useTranslations('settings.feedback');
  const locale = useLocale();
  const pathname = usePathname();

  const [type, setType] = useState<FeedbackType>('bug');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const sentHeading = useRef<HTMLHeadingElement>(null);
  // Cache the uploaded screenshot per file so a failed submit retry reuses the
  // object instead of uploading a new orphan each attempt.
  const uploaded = useRef<{ file: File; path: string } | null>(null);

  // Move focus to the confirmation so screen-reader + keyboard users land on it.
  useEffect(() => {
    if (sent) sentHeading.current?.focus();
  }, [sent]);

  const canSubmit = message.trim().length > 0 && !pending;

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0] ?? null;
    setFileError(null);
    if (next && next.size > MAX_BYTES) {
      setFileError(t('screenshotTooLarge'));
      setFile(null);
      return;
    }
    setFile(next);
  };

  const clearFile = () => {
    setFile(null);
    setFileError(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  const errorMessageFrom = async (res: Response) => {
    const body = (await res.json().catch(() => null)) as {
      error?: { code?: string };
    } | null;
    return body?.error?.code === 'RATE_LIMITED'
      ? t('rateLimitError')
      : t('error');
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setPending(true);
    setSubmitError(null);
    try {
      let screenshotPath: string | undefined;
      if (file) {
        if (uploaded.current?.file === file) {
          screenshotPath = uploaded.current.path;
        } else {
          const fd = new FormData();
          fd.append('file', file);
          const up = await fetch('/api/v1/feedback/screenshot', {
            method: 'POST',
            body: fd,
          });
          if (!up.ok) {
            setSubmitError(await errorMessageFrom(up));
            return;
          }
          const { path } = (await up.json()) as { path: string };
          uploaded.current = { file, path };
          screenshotPath = path;
        }
      }

      const payload: SubmitFeedbackInput = {
        type,
        message: message.trim(),
        screenshotPath,
        appVersion: process.env.NEXT_PUBLIC_APP_VERSION,
        platform: 'web',
        locale,
        route: pathname,
      };
      const res = await fetch('/api/v1/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setSubmitError(await errorMessageFrom(res));
        return;
      }
      setSent(true);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      setSubmitError(t('error'));
    } finally {
      setPending(false);
    }
  };

  const reset = () => {
    setSent(false);
    // Keep the last-selected type — a follow-up is often the same kind.
    setMessage('');
    setSubmitError(null);
    uploaded.current = null;
    clearFile();
  };

  return {
    type,
    setType,
    message,
    setMessage,
    file,
    fileError,
    submitError,
    pending,
    sent,
    fileInput,
    sentHeading,
    canSubmit,
    pickFile,
    clearFile,
    handleSubmit,
    reset,
  };
}
