import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind class names, resolving conflicts so the last class wins.
 *
 * This is the only place in the codebase that knows about Tailwind class
 * merging — keep `lib/ui/` free of domain logic so the coupling stays here.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
