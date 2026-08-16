import { diffLines } from 'diff';
import { cn } from '@/lib/ui/cn';

interface VersionDiffProps {
  labelA: string;
  sampleA: string;
  labelB: string;
  sampleB: string;
}

export function VersionDiff({
  labelA,
  sampleA,
  labelB,
  sampleB,
}: VersionDiffProps) {
  const hunks = diffLines(sampleA, sampleB);

  return (
    <div className="space-y-3 text-xs">
      <div className="flex gap-4 font-medium">
        <span className="text-red-600 dark:text-red-400">− {labelA}</span>
        <span className="text-green-600 dark:text-green-400">+ {labelB}</span>
      </div>

      <div className="overflow-auto rounded border font-mono">
        {hunks.map((hunk, i) => {
          const lines = hunk.value.split('\n');
          // Trailing empty string from split — drop it but keep internal empties
          if (lines.at(-1) === '') lines.pop();

          return lines.map((line, j) => (
            <div
              key={`${i}-${j}`}
              className={cn(
                'whitespace-pre px-3 py-0.5',
                hunk.added &&
                  'bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300',
                hunk.removed &&
                  'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300',
                !hunk.added && !hunk.removed && 'text-muted-foreground'
              )}
            >
              {hunk.added ? '+ ' : hunk.removed ? '- ' : '  '}
              {line}
            </div>
          ));
        })}
      </div>
    </div>
  );
}
