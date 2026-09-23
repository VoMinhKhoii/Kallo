'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ComponentProps } from 'react';
import { FormInput } from '@/components/auth/form-input';
import { cn } from '@/lib/core/ui/cn';
import {
  type PasswordIssue,
  passwordRequirements,
} from '@/lib/core/validation/password';

interface NewPasswordFieldProps
  extends Omit<ComponentProps<typeof FormInput>, 'type' | 'error'> {
  /** The field's current value (from `watch`), for the live requirement list. */
  current: string;
  /** `errors.password?.message` — a `PasswordIssue` code from the schema. */
  issue?: string;
}

const RULES = ['length', 'letter', 'digit'] as const;

/**
 * The password field for a password being CREATED (sign-up, reset). It shows
 * the policy up front as a live checklist, so the rule is visible before the
 * first failed submit instead of only after it, and turns the schema's
 * `PasswordIssue` codes into translated copy. Sign-in uses a plain
 * `FormInput`: an existing password is never judged against today's policy.
 */
export function NewPasswordField({
  current,
  issue,
  ...inputProps
}: NewPasswordFieldProps) {
  const t = useTranslations('auth.passwordRules');
  const met = passwordRequirements(current);
  const error = issue
    ? t((issue as PasswordIssue) === 'too_long' ? 'tooLong' : 'error')
    : undefined;

  return (
    <div className="space-y-2">
      <FormInput
        type="password"
        autoComplete="new-password"
        error={error}
        {...inputProps}
      />
      <ul className="flex flex-wrap gap-x-4 gap-y-1 font-sans-display text-xs">
        {RULES.map((rule) => (
          <li
            key={rule}
            className={cn(
              'flex items-center gap-1 transition-colors duration-200',
              met[rule] ? 'text-kallo-success-dark' : 'text-kallo-text-muted'
            )}
          >
            <Check
              aria-hidden
              className={cn(
                'h-3 w-3',
                met[rule] ? 'opacity-100' : 'opacity-30'
              )}
            />
            {t(rule)}
            <span className="sr-only">{met[rule] ? t('met') : t('unmet')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
