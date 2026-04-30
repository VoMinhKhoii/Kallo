'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReplayButtonProps {
  requestId: string;
}

// TODO(chunk-6): wire up replay action — POST /api/admin/replay { requestId }
export function ReplayButton({ requestId: _requestId }: ReplayButtonProps) {
  return (
    <Button
      size="sm"
      variant="outline"
      disabled
      title="Replay coming in chunk 6"
      className="gap-1.5 opacity-50"
    >
      <RefreshCw className="h-3.5 w-3.5" />
      Replay
    </Button>
  );
}
