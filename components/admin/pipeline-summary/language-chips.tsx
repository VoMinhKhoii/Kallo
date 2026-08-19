import type { z } from 'zod';
import type { decompositionSchema } from '@/lib/admin/diagnostics/stage-schemas';
import { Chip } from './stage-primitives';

export type LanguageMetadata = NonNullable<
  z.infer<typeof decompositionSchema>['languageMetadata']
>;

export function formatLanguagePair(metadata: LanguageMetadata): string {
  const input = metadata.inputLanguage ?? 'unknown';
  const output = metadata.outputLanguage ?? 'unknown';
  return `${input} → ${output}`;
}

export function LanguageMetadataChips({
  metadata,
}: {
  metadata: LanguageMetadata;
}) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
      <Chip>
        <span translate="no">{formatLanguagePair(metadata)}</span>
      </Chip>
      {metadata.retryCount > 0 ? (
        <Chip>
          <span className="tabular-nums">{metadata.retryCount} lang retry</span>
        </Chip>
      ) : null}
      {!metadata.guardPassed ? <Chip>language mismatch</Chip> : null}
    </span>
  );
}
