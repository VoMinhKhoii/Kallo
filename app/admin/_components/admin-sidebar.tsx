'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const items = [
  { href: '/admin/requests', label: 'Requests' },
  { href: '/admin/prompts', label: 'Prompts' },
  { href: '/admin/health', label: 'Health' },
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <nav className="w-48 border-r p-4" aria-label="Admin navigation">
      <ul className="space-y-1 text-sm">
        {items.map((it) => {
          const active =
            pathname === it.href || pathname.startsWith(`${it.href}/`);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block rounded px-2 py-1 hover:bg-muted',
                  active && 'bg-muted font-medium'
                )}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
