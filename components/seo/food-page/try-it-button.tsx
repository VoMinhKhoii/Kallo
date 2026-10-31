'use client';

import { useAuthDialog } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';

/** The page's one button: open sign-up, as the landing header does. */
export function TryItButton({ children }: { children: React.ReactNode }) {
  const { openDialog } = useAuthDialog();
  return (
    <Button
      variant="landing-ink"
      className="h-11 px-6 font-sans-display"
      onClick={() => openDialog('sign-up')}
    >
      {children}
    </Button>
  );
}
