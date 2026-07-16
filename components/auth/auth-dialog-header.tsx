import { KalloAppIcon } from '@/components/brand/kallo-app-icon';

/** Auth dialog header — app icon tile above the title and subtitle. */
export function AuthDialogHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="px-8 pt-8 pb-2 text-center">
      <KalloAppIcon className="mx-auto mb-4 w-12 rounded-xl" />
      <h2
        id="auth-dialog-title"
        className="mb-1 font-normal font-serif text-2xl text-nham-text"
      >
        {title}
      </h2>
      <p className="font-sans-display text-nham-text-muted text-sm">
        {subtitle}
      </p>
    </div>
  );
}
