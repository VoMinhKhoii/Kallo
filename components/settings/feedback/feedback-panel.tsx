'use client';

import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SettingsGroup } from '../group';
import { FeedbackForm } from './feedback-form';
import { useFeedbackForm } from './use-feedback-form';

/**
 * In-app feedback: pick a type (bug / ingredient request / idea), write a
 * message, optionally attach a screenshot, and submit.
 *
 * Talks to the same `/api/v1/feedback*` routes the mobile app uses (rather than
 * calling the server actions directly) so the structured error envelope — and
 * in particular a rate-limit message with a wait hint — reaches the UI instead
 * of being redacted at the server-action boundary in production.
 *
 * Thin composer: one SettingsGroup that shows either the success rows or the
 * form. All state/logic lives in `useFeedbackForm`.
 */
export function FeedbackPanel() {
  const t = useTranslations('settings.feedback');
  const form = useFeedbackForm();

  return (
    <SettingsGroup>
      {form.sent ? (
        <div
          role="status"
          className="flex flex-col items-center gap-4 p-card-sm py-8 text-center"
        >
          <CheckCircle2 className="size-8 text-[#7A9B76]" aria-hidden />
          <div>
            <h3
              ref={form.sentHeading}
              tabIndex={-1}
              className="font-serif text-kallo-text text-lg outline-none"
            >
              {t('successTitle')}
            </h3>
            <p className="mt-1 max-w-sm text-[14px] text-kallo-text-soft">
              {t('successBody')}
            </p>
          </div>
          <button
            type="button"
            onClick={form.reset}
            className="rounded-lg border border-kallo-border bg-white px-4 py-2 font-medium text-kallo-text text-sm transition-colors hover:border-kallo-accent/50"
          >
            {t('sendAnother')}
          </button>
        </div>
      ) : (
        // One wrapper div = one direct child of the group, so the form rows
        // get no hairlines between them (they're all one subsection).
        <div>
          <FeedbackForm
            type={form.type}
            setType={form.setType}
            message={form.message}
            setMessage={form.setMessage}
            file={form.file}
            fileError={form.fileError}
            submitError={form.submitError}
            pending={form.pending}
            fileInput={form.fileInput}
            canSubmit={form.canSubmit}
            pickFile={form.pickFile}
            clearFile={form.clearFile}
            handleSubmit={form.handleSubmit}
          />
        </div>
      )}
    </SettingsGroup>
  );
}
