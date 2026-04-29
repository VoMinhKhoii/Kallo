const items = [
  { href: '/admin/requests', label: 'Requests' },
  { href: '/admin/prompts', label: 'Prompts' },
  { href: '/admin/health', label: 'Health' },
];

export function AdminSidebar() {
  return (
    <nav className="w-48 border-r p-4">
      <ul className="space-y-1 text-sm">
        {items.map((it) => (
          <li key={it.href}>
            <a
              className="block rounded px-2 py-1 hover:bg-muted"
              href={it.href}
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
