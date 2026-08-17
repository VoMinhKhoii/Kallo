'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/core/ui/cn';

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
      <label className="block font-medium font-sans-display text-kallo-text text-xs tracking-wide">
        {label}
      </label>
      <div className="relative">
        <input
          type={isPassword && showPassword ? 'text' : type}
          placeholder={placeholder}
          className={cn(
            'w-full rounded-xl border bg-white px-4 py-3 text-kallo-text text-sm outline-none transition-all duration-200 placeholder:text-kallo-text-muted/70',
            error
              ? 'border-kallo-danger/50 focus:border-kallo-danger focus:ring-2 focus:ring-kallo-danger/10'
              : 'border-kallo-border/60 focus:border-kallo-accent focus:ring-2 focus:ring-kallo-accent/10',
            'font-sans-display'
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-kallo-text-muted/50 transition-colors hover:text-kallo-text-muted"
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
        <p className="font-sans-display text-kallo-danger text-xs">{error}</p>
      )}
    </div>
  );
}
