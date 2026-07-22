'use client';

import { Bug, ImageIcon, ImagePlus, Lightbulb, Sprout, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FEEDBACK_TYPES } from '@/lib/api/contracts/feedback';
import { cn } from '@/lib/utils';
import { SettingsRow } from '../group';
import {
  ACCEPTED,
  MAX_LENGTH,
  type useFeedbackForm,
} from './use-feedback-form';

type FeedbackType = (typeof FEEDBACK_TYPES)[number];

const TYPE_ICONS: Record<FeedbackType, typeof Bug> = {
  bug: Bug,
  ingredient: Sprout,
  idea: Lightbulb,
};

type FeedbackFormProps = Pick<
  ReturnType<typeof useFeedbackForm>,
  | 'type'
  | 'setType'
  | 'message'
  | 'setMessage'
  | 'file'
  | 'fileError'
  | 'submitError'
  | 'pending'
  | 'fileInput'
  | 'canSubmit'
  | 'pickFile'
  | 'clearFile'
  | 'handleSubmit'
>;

/**
 * The feedback form as grouped list-rows: type pills, message + counter,
 * screenshot attach, and a footer submit row. Hairlines come from the parent
 * SettingsGroup's `divide-y`; no row draws its own border.
 */
export function FeedbackForm({
  type,
  setType,
  message,
  setMessage,
  file,
  fileError,
  submitError,
  pending,
  fileInput,
  canSubmit,
  pickFile,
  clearFile,
  handleSubmit,
}: FeedbackFormProps) {
  const t = useTranslations('settings.feedback');

  return (
    <>
      {/* Type */}
      <SettingsRow label={t('typeLabel')} layout="stacked">
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
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent/60',
                  active
                    ? 'border-nham-border bg-nham-hover font-semibold text-nham-text'
                    : 'border-[#EAE7E0] bg-white text-[#7B6F62] hover:border-nham-accent/50'
                )}
              >
                <Icon className="size-4" aria-hidden />
                {t(`types.${option}`)}
              </button>
            );
          })}
        </div>
      </SettingsRow>

      {/* Message */}
      <SettingsRow
        label={t('messageLabel')}
        htmlFor="feedback-message"
        layout="stacked"
      >
        <textarea
          id="feedback-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t(`placeholder.${type}`)}
          maxLength={MAX_LENGTH}
          rows={5}
          aria-required="true"
          className="w-full resize-y rounded-xl border border-[#EAE7E0] bg-white px-3 py-2.5 text-[14px] text-nham-text placeholder:text-[#A79B8B] focus-visible:border-nham-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent/60"
        />
        <p className="mt-1 text-right text-[#A79B8B] text-[12px] tabular-nums">
          {message.length} / {MAX_LENGTH}
        </p>
      </SettingsRow>

      {/* Screenshot */}
      <SettingsRow label={t('addScreenshot')} layout="inline">
        <div className="min-w-0">
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED}
            onChange={pickFile}
            className="hidden"
          />
          {file ? (
            <div className="flex items-center gap-2 rounded-xl border border-[#EAE7E0] bg-white px-3 py-2 text-[13px]">
              <ImageIcon
                className="size-4 shrink-0 text-[#7B6F62]"
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-nham-text">
                {file.name}
              </span>
              <button
                type="button"
                onClick={clearFile}
                aria-label={t('removeScreenshot')}
                className="shrink-0 rounded-md p-1 text-[#7B6F62] transition-colors hover:text-nham-text"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex items-center gap-2 rounded-xl border border-[#EAE7E0] border-dashed bg-white px-3 py-2 text-[#7B6F62] text-[13px] transition-colors hover:border-nham-accent/50 hover:text-nham-text"
            >
              <ImagePlus className="size-4" aria-hidden />
              {t('addScreenshot')}
            </button>
          )}
          {fileError && (
            <p role="alert" className="mt-1.5 text-[13px] text-nham-danger">
              {fileError}
            </p>
          )}
        </div>
      </SettingsRow>

      {/* Footer: submit + submit error */}
      <div className="flex flex-col items-end gap-2 p-card-sm">
        {submitError && (
          <p role="alert" className="w-full text-[13px] text-nham-danger">
            {submitError}
          </p>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full rounded-lg bg-nham-ink px-4 py-2.5 font-medium text-nham-surface text-sm transition-opacity disabled:opacity-50 sm:w-auto"
        >
          {pending ? t('submitting') : t('submit')}
        </button>
      </div>
    </>
  );
}
