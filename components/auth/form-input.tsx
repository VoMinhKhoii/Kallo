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
      <label
        className="block font-medium text-[#2C2416] text-xs tracking-wide"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        {label}
      </label>
      <div className="relative">
        <input
          type={isPassword && showPassword ? 'text' : type}
          placeholder={placeholder}
          className={cn(
            'w-full rounded-xl border bg-white px-4 py-3 text-[#2C2416] text-sm outline-none transition-all duration-200 placeholder:text-[#B0A695]',
            error
              ? 'border-nham-danger/50 focus:border-nham-danger focus:ring-2 focus:ring-nham-danger/10'
              : 'border-[#E8D5B5]/60 focus:border-[#C9A87C] focus:ring-2 focus:ring-[#C9A87C]/10'
          )}
          style={{ fontFamily: 'DM Sans, sans-serif' }}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-[#8B7355]/50 transition-colors hover:text-[#8B7355]"
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
        <p
          className="text-nham-danger text-xs"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
