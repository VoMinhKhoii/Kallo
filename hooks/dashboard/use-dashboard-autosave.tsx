'use client';

import { Undo2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  useConfirmMeal,
  useDeleteMeal,
} from '@/hooks/meals/use-meal-mutations';
import type { useStreamAnalysis } from '@/hooks/meals/use-stream-analysis';

/**
 * Dashboard quick-capture has no confirm step: when the stream resolves, save
 * the meal automatically and surface an Undo toast (which deletes it). Owns the
 * `isSaving` flag and the once-per-analysis guard; `onSettled` lets the caller
 * clear its own submitted-text state. Returns whether a save is in flight.
 */
export function useDashboardAutoSave(args: {
  userId: string;
  stream: ReturnType<typeof useStreamAnalysis>;
  todayDate: string;
  submittedText: string | null;
  submittedAtRef: RefObject<Date | null>;
  /** Called only after a SUCCESSFUL save, to clear the caller's draft state. */
  onSaved: () => void;
}): boolean {
  const { userId, stream, todayDate, submittedText, submittedAtRef, onSaved } =
    args;
  const t = useTranslations('dashboard');
  const { mutate: confirm } = useConfirmMeal(userId);
  const { mutate: removeMeal } = useDeleteMeal(userId, todayDate);
  const { reset } = stream;

  const [isSaving, setIsSaving] = useState(false);
  const confirmedAnalysisRef = useRef<string | null>(null);

  useEffect(() => {
    if (stream.status !== 'done' || !stream.result || !stream.analysisId) {
      return;
    }
    if (confirmedAnalysisRef.current === stream.analysisId) return;
    confirmedAnalysisRef.current = stream.analysisId;

    const mealId = crypto.randomUUID();
    setIsSaving(true);
    confirm(
      {
        analysisId: stream.analysisId,
        mealId,
        originDate: todayDate,
        parsedMeal: stream.result,
        rawInput: submittedText ?? '',
        loggedAt: (submittedAtRef.current ?? new Date()).toISOString(),
      },
      {
        onSuccess: () => {
          // Custom action node (not sonner's {label, onClick} form) so the
          // button carries the back icon + hover; dismissal is manual.
          const toastId = toast.success(t('streaming.saved'), {
            action: (
              <button
                type="button"
                onClick={() => {
                  removeMeal({ mealId });
                  toast.dismiss(toastId);
                }}
                className="ml-auto flex shrink-0 items-center gap-1.5 rounded-lg bg-kallo-btn px-2.5 py-1.5 font-medium text-white text-xs transition-colors hover:bg-kallo-btn-hover"
              >
                <Undo2 aria-hidden className="h-3.5 w-3.5" />
                {t('streaming.undo')}
              </button>
            ),
          });
          // Clear the draft + reset the stream only on SUCCESS. On failure both
          // are kept so the user can retry (onError unlocks the guard).
          onSaved();
          reset();
        },
        onError: () => {
          // Release the once-per-analysis guard so a retry — same attempt id →
          // same analysisId (upsert) — can re-trigger the auto-save.
          confirmedAnalysisRef.current = null;
        },
        onSettled: () => {
          setIsSaving(false);
        },
      }
    );
  }, [
    confirm,
    removeMeal,
    reset,
    onSaved,
    stream.analysisId,
    stream.result,
    stream.status,
    submittedText,
    submittedAtRef,
    t,
    todayDate,
  ]);

  return isSaving;
}
