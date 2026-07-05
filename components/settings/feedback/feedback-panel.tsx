'use client';

import {
  Bug,
  CheckCircle2,
  ImagePlus,
  Lightbulb,
  Sprout,
  X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from '@/i18n/navigation';
import type { SubmitFeedbackInput } from '@/lib/api/contracts/feedback';
import { FEEDBACK_TYPES } from '@/lib/api/contracts/feedback';

type FeedbackType = (typeof FEEDBACK_TYPES)[number];

const TYPE_ICONS: Record<FeedbackType, typeof Bug> = {
  bug: Bug,
  ingredient: Sprout,
  idea: Lightbulb,
};

const MAX_LENGTH = 4000;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = 'image/png,image/jpeg,image/webp';

/**
 * In-app feedback: pick a type (bug / ingredient request / idea), write a
 * message, optionally attach a screenshot, and submit.
 *
 * Talks to the same `/api/v1/feedback*` routes the mobile app uses (rather than
 * calling the server actions directly) so the structured error envelope — and
 * in particular a rate-limit message with a wait hint — reaches the UI instead
 * of being redacted at the server-action boundary in production.
 */
export function FeedbackPanel() {
  const t = useTranslations('settings.feedback');
  const locale = useLocale();
  const pathname = usePathname();

  const [type, setType] = useState<FeedbackType>('bug');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const sentHeading = useRef<HTMLHeadingElement>(null);
  // Cache the uploaded screenshot per file so a failed submit retry reuses the
  // object instead of uploading a new orphan each attempt.
  const uploaded = useRef<{ file: File; path: string } | null>(null);

  // Object-URL preview for the chosen image; revoked when it changes / unmounts.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

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

  if (sent) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-4 rounded-2xl border border-[#EAE7E0] bg-[#FDFCF8] px-4 py-12 text-center"
      >
        <CheckCircle2 className="size-8 text-[#7A9B76]" aria-hidden />
        <div>
          <h3
            ref={sentHeading}
            tabIndex={-1}
            className="font-serif text-[#2C2416] text-lg outline-none"
          >
            {t('successTitle')}
          </h3>
          <p className="mt-1 max-w-sm text-[#6B5D4F] text-[14px]">
            {t('successBody')}
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-[#EAE7E0] bg-white px-4 py-2 font-medium text-[#2C2416] text-sm transition-colors hover:border-[#C9A87C]/50"
        >
          {t('sendAnother')}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#EAE7E0] bg-[#FDFCF8] p-4 sm:p-5">
      {/* Type selector */}
      <fieldset>
        <legend className="mb-2 font-medium text-[#2C2416] text-[14px]">
          {t('typeLabel')}
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {FEEDBACK_TYPES.map((option) => {
            const Icon = TYPE_ICONS[option];
            const active = type === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setType(option)}
                aria-pressed={active}
                className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/60 ${
                  active
                    ? 'border-[#C9A87C] bg-[#C9A87C]/10 text-[#2C2416]'
                    : 'border-[#EAE7E0] bg-white text-[#7B6F62] hover:border-[#C9A87C]/50'
                }`}
              >
                <Icon className="size-4" aria-hidden />
                {t(`types.${option}`)}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Message */}
      <label
        htmlFor="feedback-message"
        className="mt-4 mb-2 block font-medium text-[#2C2416] text-[14px]"
      >
        {t('messageLabel')}
      </label>
      <textarea
        id="feedback-message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t(`placeholder.${type}`)}
        maxLength={MAX_LENGTH}
        rows={5}
        aria-required="true"
        className="w-full resize-y rounded-xl border border-[#EAE7E0] bg-white px-3 py-2.5 text-[#2C2416] text-[14px] placeholder:text-[#A79B8B] focus-visible:border-[#C9A87C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/60"
      />
      <p className="mt-1 text-right text-[#A79B8B] text-[12px] tabular-nums">
        {message.length} / {MAX_LENGTH}
      </p>

      {/* Screenshot */}
      <div className="mt-2">
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED}
          onChange={pickFile}
          className="hidden"
        />
        {file ? (
          <div className="flex items-center gap-3 rounded-xl border border-[#EAE7E0] bg-white px-3 py-2 text-[13px]">
            {previewUrl && (
              // biome-ignore lint/performance/noImgElement: local object-URL thumbnail of the just-picked file; next/image can't optimize a blob URL.
              <img
                src={previewUrl}
                alt=""
                className="size-9 shrink-0 rounded-md object-cover"
              />
            )}
            <span className="min-w-0 flex-1 truncate text-[#2C2416]">
              {file.name}
            </span>
            <button
              type="button"
              onClick={clearFile}
              aria-label={t('removeScreenshot')}
              className="shrink-0 rounded-md p-1 text-[#7B6F62] transition-colors hover:text-[#2C2416]"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex items-center gap-2 rounded-xl border border-[#EAE7E0] border-dashed bg-white px-3 py-2 text-[#7B6F62] text-[13px] transition-colors hover:border-[#C9A87C]/50 hover:text-[#2C2416]"
          >
            <ImagePlus className="size-4" aria-hidden />
            {t('addScreenshot')}
          </button>
        )}
        {fileError && (
          <p role="alert" className="mt-1.5 text-[#D37B69] text-[13px]">
            {fileError}
          </p>
        )}
      </div>

      {submitError && (
        <p role="alert" className="mt-3 text-[#D37B69] text-[13px]">
          {submitError}
        </p>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="mt-4 w-full rounded-lg bg-[#2C2416] px-4 py-2.5 font-medium text-[#FEFBF6] text-sm transition-opacity disabled:opacity-50 sm:w-auto"
      >
        {pending ? t('submitting') : t('submit')}
      </button>
    </div>
  );
}
