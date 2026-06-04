import { diffLines } from 'diff';
import { cn } from '@/lib/utils';

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
        <span className="text-nham-danger">− {labelA}</span>
        <span className="text-nham-success">+ {labelB}</span>
      </div>

      <div className="overflow-auto rounded-md border border-nham-border/60 font-mono">
        {hunks.map((hunk, i) => {
          const lines = hunk.value.split('\n');
          // Trailing empty string from split — drop it but keep internal empties
          if (lines.at(-1) === '') lines.pop();

          return lines.map((line, j) => (
            <div
              key={`${i}-${j}`}
              className={cn(
                'whitespace-pre px-3 py-0.5',
                hunk.added && 'bg-nham-success/10 text-nham-success',
                hunk.removed && 'bg-nham-danger/10 text-nham-danger',
                !hunk.added && !hunk.removed && 'text-nham-text-muted'
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
