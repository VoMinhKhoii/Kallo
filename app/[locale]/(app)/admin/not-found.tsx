import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export default function AdminNotFound() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center font-sans-display">
      <h2
        className="font-semibold text-lg text-nham-text"
        style={{ fontFamily: 'Lora, serif' }}
      >
        Not found
      </h2>
      <p className="max-w-md text-nham-text-muted text-sm">
        The admin resource you’re looking for doesn’t exist or has been removed.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link href="/admin">Back to admin</Link>
      </Button>
    </div>
  );
}
