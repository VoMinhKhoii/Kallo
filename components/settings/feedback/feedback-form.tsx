'use client';

import { Bug, ImageIcon, ImagePlus, Lightbulb, Sprout, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { OptionStrip } from '@/components/settings/chrome/option-strip';
import { FEEDBACK_TYPES } from '@/lib/api/contracts/feedback';
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
 * The feedback form as one compact padded block: type strip (same OptionStrip
 * control the cooking rows use), message with an inline counter, and a footer
 * that pairs the screenshot attach with the submit button.
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
    <div className="space-y-5 p-card-sm">
      {/* Type */}
      <div>
        <p className="text-[15px] text-kallo-text">{t('typeLabel')}</p>
        <div className="mt-2">
          <OptionStrip
            options={FEEDBACK_TYPES.map((option) => ({
              value: option,
              label: t(`types.${option}`),
              icon: TYPE_ICONS[option],
            }))}
            value={type}
            onChange={(next) => setType(next as FeedbackType)}
          />
        </div>
      </div>

      {/* Message */}
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label
            htmlFor="feedback-message"
            className="text-[15px] text-kallo-text"
          >
            {t('messageLabel')}
          </label>
          <span className="text-[12px] text-kallo-text-muted tabular-nums">
            {message.length} / {MAX_LENGTH}
          </span>
        </div>
        <textarea
          id="feedback-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t(`placeholder.${type}`)}
          maxLength={MAX_LENGTH}
          rows={3}
          aria-required="true"
          className="mt-2 w-full resize-y rounded-xl border border-kallo-border bg-white px-3 py-2.5 text-[14px] text-kallo-text placeholder:text-kallo-text-muted focus-visible:border-kallo-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/60"
        />
      </div>

      {(fileError || submitError) && (
        <p role="alert" className="text-[13px] text-kallo-danger">
          {fileError ?? submitError}
        </p>
      )}

      {/* Footer: screenshot attach + submit */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED}
          onChange={pickFile}
          className="hidden"
        />
        {file ? (
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-kallo-border bg-white px-3 py-2 text-[13px]">
            <ImageIcon
              className="size-4 shrink-0 text-kallo-text-muted"
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-kallo-text">
              {file.name}
            </span>
            <button
              type="button"
              onClick={clearFile}
              aria-label={t('removeScreenshot')}
              className="shrink-0 rounded-md p-1 text-kallo-text-muted transition-colors hover:text-kallo-text"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex items-center gap-2 rounded-xl border border-kallo-border border-dashed bg-white px-3 py-2 text-[13px] text-kallo-text-muted transition-colors hover:border-kallo-accent/50 hover:text-kallo-text"
          >
            <ImagePlus className="size-4" aria-hidden />
            {t('addScreenshot')}
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded-lg bg-kallo-btn px-4 py-2 font-medium text-sm text-white transition-opacity disabled:opacity-50"
        >
          {pending ? t('submitting') : t('submit')}
        </button>
      </div>
    </div>
  );
}
