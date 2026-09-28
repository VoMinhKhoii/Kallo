'use client';

import { useCallback, useRef, useState } from 'react';
import { carryAmount, type ScanAmount } from '@/lib/domain/scan/amount';
import type { ScanFood } from '@/lib/domain/scan/food';
import { saveScanFood } from './save';

/**
 * What the dialog does with a result: type a code, edit or type a food, size
 * it, add it — the web twin of the Flutter app's `ScanResultActions`. Holds
 * the result's own state, which a fresh scan or a mode switch clears in one
 * place (`clear`).
 */
export function useScanResult({
  loggedDate,
  onSaved,
  onLocked,
}: {
  loggedDate: string;
  onSaved: () => void;
  /** The server refused the save as Premium. */
  onLocked: () => void;
}) {
  const [typing, setTyping] = useState(false);
  const [editing, setEditing] = useState<{
    food: ScanFood;
    isNew: boolean;
  } | null>(null);
  /** A food the user edited or typed — it wins over the scanned one. */
  const [editedFood, setEditedFood] = useState<ScanFood | null>(null);
  /** Held here, not in the result panel, so it survives an edit. */
  const [amount, setAmountState] = useState<ScanAmount | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savingRef = useRef(false);
  /** One id per save — this food at this amount — kept across its retries;
   *  a different food or amount is a different meal, and a new id. */
  const mealIdRef = useRef<string | null>(null);

  const clear = useCallback(() => {
    mealIdRef.current = null;
    setTyping(false);
    setEditing(null);
    setEditedFood(null);
    setAmountState(null);
    setSaveError(null);
  }, []);

  const finishEditing = useCallback(
    (food: ScanFood) => {
      if (editing) setAmountState((a) => carryAmount(a, editing.food, food));
      mealIdRef.current = null;
      setEditedFood(food);
      setEditing(null);
      setSaveError(null);
    },
    [editing]
  );

  /** Ignored mid-save: the amount being saved must not move under it. */
  const setAmount = useCallback((next: ScanAmount) => {
    if (savingRef.current) return;
    mealIdRef.current = null;
    setAmountState(next);
  }, []);

  /** Log `food` at `resolved` and close on success; a failure keeps the
   *  result, its amount and edits, with the reason beside Add meal. */
  const add = useCallback(
    async (food: ScanFood, resolved: number) => {
      // A second click before the spinner shows must not log it twice.
      if (savingRef.current) return;
      savingRef.current = true;
      setSaving(true);
      setSaveError(null);
      try {
        mealIdRef.current ??= crypto.randomUUID();
        const result = await saveScanFood({
          food,
          amount: resolved,
          loggedDate,
          mealId: mealIdRef.current,
        });
        if (result.ok || result.locked) {
          // The dialog stays mounted between opens: a finished result must
          // not be waiting the next time it opens.
          clear();
          if (result.ok) onSaved();
          else onLocked();
        } else setSaveError(result.errorKey);
      } catch {
        setSaveError('barcodeError.server_error');
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [clear, loggedDate, onLocked, onSaved]
  );

  return {
    typing,
    setTyping,
    editing,
    openEditor: (food: ScanFood, isNew: boolean) => setEditing({ food, isNew }),
    cancelEditing: () => setEditing(null),
    finishEditing,
    editedFood,
    amount,
    setAmount,
    saving,
    saveError,
    add,
    clear,
  };
}
