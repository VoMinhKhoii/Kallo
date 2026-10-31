'use client';

import type { ReactNode } from 'react';
import { useFormState } from 'react-hook-form';

/**
 * A page holding profile-form fields, wrapped in a <form> so Enter saves.
 * The save bar's button lives outside it (the bar shows on every page), and a
 * form with several text fields and no submit button ignores Enter — so a
 * hidden submit button stands in while there is something to save, as the
 * old page's save bar did.
 */
export function ProfileFormPage({
  onSubmit,
  children,
}: {
  onSubmit: () => void;
  children: ReactNode;
}) {
  const { isDirty } = useFormState();

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {children}
      {isDirty && (
        <button
          type="submit"
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
        />
      )}
    </form>
  );
}
