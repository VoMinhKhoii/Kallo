import { Link } from '@/i18n/navigation';

/** Renders a compare link that toggles compare/with query params. */
export function CompareLink({
  href,
  versionId,
  currentCompare,
  currentWith,
}: {
  href: string;
  versionId: string;
  currentCompare: string | undefined;
  currentWith: string | undefined;
}) {
  // If neither slot filled — pick as base
  if (!currentCompare) {
    return (
      <Link
        href={`${href}?compare=${versionId}`}
        className="text-blue-600 text-xs hover:underline dark:text-blue-400"
      >
        Select A
      </Link>
    );
  }

  // Base filled, no target — pick as target (unless this IS the base)
  if (versionId === currentCompare) {
    return (
      <Link
        href={href}
        className="text-muted-foreground text-xs hover:underline"
      >
        Clear A
      </Link>
    );
  }

  if (!currentWith) {
    return (
      <Link
        href={`${href}?compare=${currentCompare}&with=${versionId}`}
        className="text-blue-600 text-xs hover:underline dark:text-blue-400"
      >
        Compare with A
      </Link>
    );
  }

  // Both filled — clicking another clears and starts fresh
  if (versionId === currentWith) {
    return (
      <Link
        href={`${href}?compare=${currentCompare}`}
        className="text-muted-foreground text-xs hover:underline"
      >
        Clear B
      </Link>
    );
  }

  return (
    <Link
      href={`${href}?compare=${currentCompare}&with=${versionId}`}
      className="text-blue-600 text-xs hover:underline dark:text-blue-400"
    >
      Compare with A
    </Link>
  );
}
