import { cn } from '@/lib/utils';

/**
 * A circular profile avatar: the person's Google/Gmail picture when we have one
 * (captured into public_profiles at sign-in), falling back to the first letter
 * of their label on a warm disc. `referrerPolicy="no-referrer"` is required —
 * googleusercontent rejects hotlinked requests that carry a referer.
 */
export function ProfileAvatar({
  avatarUrl,
  label,
  className,
}: {
  avatarUrl: string | null;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E8E6DC]',
        className
      )}
    >
      {avatarUrl ? (
        // biome-ignore lint/performance/noImgElement: remote Google avatars aren't worth a next/image remotePatterns entry
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="size-full object-cover"
        />
      ) : (
        <span className="font-bold font-sans-display text-[#141413] text-[12px]">
          {label.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}
