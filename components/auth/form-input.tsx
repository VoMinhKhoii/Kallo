'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  type?: string;
  placeholder?: string;
  error?: string;
}

export function FormInput({
  label,
  type = 'text',
  placeholder,
  error,
  ...props
}: FormInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="space-y-1.5">
      <label className="block font-medium font-sans-display text-nham-text text-xs tracking-wide">
        {label}
      </label>
      <div className="relative">
        <input
          type={isPassword && showPassword ? 'text' : type}
          placeholder={placeholder}
          className={cn(
            'w-full rounded-xl border bg-white px-4 py-3 text-nham-text text-sm outline-none transition-all duration-200 placeholder:text-nham-text-muted/70',
            error
              ? 'border-nham-danger/50 focus:border-nham-danger focus:ring-2 focus:ring-nham-danger/10'
              : 'border-nham-border/60 focus:border-nham-accent focus:ring-2 focus:ring-nham-accent/10',
            'font-sans-display'
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-nham-text-muted/50 transition-colors hover:text-nham-text-muted"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
      {error && (
        <p className="font-sans-display text-nham-danger text-xs">{error}</p>
      )}
    </div>
  );
}
