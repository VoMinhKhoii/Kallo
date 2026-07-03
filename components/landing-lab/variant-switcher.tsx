'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const VARIANTS = [
  { id: 'v1', label: 'Shader' },
  { id: 'v2', label: '3D' },
  { id: 'v3', label: 'Type' },
  { id: 'v4', label: 'Dark' },
] as const;

/**
 * Fixed pill for hopping between the /v1../v4 design prototypes.
 * Lab-only chrome — deleted with the lab once a direction wins.
 */
export function VariantSwitcher() {
  const pathname = usePathname();
  const current = pathname.match(/\/(v[1-4])(?:\/|$)/)?.[1];

  return (
    <nav
      aria-label="Design prototypes"
      className="fixed right-4 bottom-4 z-50 flex items-center gap-1 rounded-full border border-[#E8D5B5] bg-white/90 p-1 shadow-[0_10px_32px_rgba(44,36,22,0.12)] backdrop-blur-md"
    >
      <span className="px-2 font-bold text-[#8B7355] text-[10px] uppercase tracking-[0.2em]">
        Lab
      </span>
      {VARIANTS.map((variant) => {
        const active = variant.id === current;
        return (
          <Link
            key={variant.id}
            href={
              current
                ? pathname.replace(/\/v[1-4](?=\/|$)/, `/${variant.id}`)
                : `/${variant.id}`
            }
            aria-current={active ? 'page' : undefined}
            className={`rounded-full px-3 py-1.5 font-medium text-xs transition-colors ${
              active
                ? 'bg-[#695E4E] text-[#FEFBF6]'
                : 'text-[#6B5D4F] hover:bg-[#F0EAE0] hover:text-[#2C2416]'
            }`}
          >
            {variant.label}
          </Link>
        );
      })}
    </nav>
  );
}
