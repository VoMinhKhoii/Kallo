'use client';
import { RefreshCw } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { replayRequest } from '../actions';

interface ReplayButtonProps {
  requestId: string;
}

export function ReplayButton({ requestId }: ReplayButtonProps) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      aria-busy={pending}
      className="gap-1.5"
      onClick={() =>
        start(async () => {
          try {
            await replayRequest(requestId);
          } catch (e) {
            if (
              (e as { digest?: string })?.digest?.startsWith?.('NEXT_REDIRECT')
            )
              throw e;
            toast.error(e instanceof Error ? e.message : 'Replay failed');
          }
        })
      }
    >
      <RefreshCw className={cn('h-3.5 w-3.5', pending && 'animate-spin')} />
      {pending ? 'Replaying…' : 'Replay (dry-run)'}
    </Button>
  );
}
