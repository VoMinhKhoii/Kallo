import { dialogShell } from '@/components/shared/dialog-shell/dialog-shell';
import { cn } from '@/lib/core/ui/cn';

interface SectionHeaderProps {
  title: string;
}

/**
 * The heading that opens each settings dialog page, in the same Lora title
 * as the rail's "Settings" (dialogShell.title), so the two sit on one line
 * across the dialog and read as one family.
 */
export function SectionHeader({ title }: SectionHeaderProps) {
  return <h2 className={cn(dialogShell.title, 'mb-6')}>{title}</h2>;
}
