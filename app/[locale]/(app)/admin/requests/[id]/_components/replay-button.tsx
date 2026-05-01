'use client';
import { RefreshCw } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { replayRequest } from '../actions';

interface ReplayButtonProps {
  requestId: string;
  /**
   * When true, replays via mocked Gemini that returns captured responses.
   * No tokens spent. Defaults to false (real replay against live model).
   */
  dryRun?: boolean;
}

export function ReplayButton({ requestId, dryRun = false }: ReplayButtonProps) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  const label = dryRun ? 'Replay (dry-run)' : 'Replay';
  const confirmTitle = dryRun
    ? 'Dry-run replay this request?'
    : 'Replay this request?';
  const confirmDescription = dryRun
    ? 'Replays downstream stages using captured LLM responses. No tokens are spent. A new request row will be created and you will be redirected to it.'
    : 'Calls the real Gemini model and creates a new request. This consumes API quota and may produce different results from the original.';

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          aria-busy={pending}
          className="gap-1.5"
        >
          <RefreshCw
            className={cn('h-3.5 w-3.5', pending && 'animate-spin')}
            aria-hidden="true"
          />
          {pending ? 'Replaying…' : label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setOpen(false);
              start(async () => {
                try {
                  await replayRequest(requestId, { dryRun });
                } catch (e) {
                  if (
                    (e as { digest?: string })?.digest?.startsWith?.(
                      'NEXT_REDIRECT'
                    )
                  )
                    throw e;
                  toast.error(e instanceof Error ? e.message : 'Replay failed');
                }
              });
            }}
          >
            {dryRun ? 'Dry-run replay' : 'Replay'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
