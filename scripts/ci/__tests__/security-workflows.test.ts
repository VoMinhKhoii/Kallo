import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readWorkflow(name: string): string {
  return readFileSync(resolve('.github/workflows', name), 'utf8');
}

describe('GitHub security workflows', () => {
  it('skips CodeQL when the repository is private', () => {
    const workflow = readWorkflow('codeql.yml');

    expect(workflow).toContain('if: github.event.repository.private == false');
  });

  it('only runs dependency review for public pull requests', () => {
    const workflow = readWorkflow('ci.yml');

    expect(workflow).toContain(
      "if: github.event_name == 'pull_request' && " +
        'github.event.repository.private == false'
    );
  });
});
