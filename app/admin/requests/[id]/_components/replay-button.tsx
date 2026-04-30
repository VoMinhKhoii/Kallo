'use client';
import { RefreshCw } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
      className="gap-1.5"
      onClick={() =>
        start(async () => {
          try {
            await replayRequest(requestId);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Replay failed');
          }
        })
      }
    >
      <RefreshCw className="h-3.5 w-3.5" />
      {pending ? 'Replaying…' : 'Replay (dry-run)'}
    </Button>
  );
}
