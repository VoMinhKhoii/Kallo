import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AdminNotFound() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
      <h2 className="font-semibold text-lg">Not found</h2>
      <p className="max-w-md text-muted-foreground text-sm">
        The admin resource you’re looking for doesn’t exist or has been removed.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link href="/admin">Back to admin</Link>
      </Button>
    </div>
  );
}
