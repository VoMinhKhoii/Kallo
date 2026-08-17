/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VersionDiff } from '../version-diff';

describe('VersionDiff', () => {
  it('labels the two sides with − and +', () => {
    render(<VersionDiff labelA="aaa" sampleA="x" labelB="bbb" sampleB="y" />);
    expect(screen.getByText('− aaa')).toBeInTheDocument();
    expect(screen.getByText('+ bbb')).toBeInTheDocument();
  });

  it('prefixes added, removed and context lines', () => {
    const { container } = render(
      <VersionDiff
        labelA="a"
        sampleA={'keep\nold\n'}
        labelB="b"
        sampleB={'keep\nnew\n'}
      />
    );
    const lines = [...container.querySelectorAll('.whitespace-pre')].map(
      (el) => el.textContent
    );
    expect(lines).toContain('  keep');
    expect(lines).toContain('- old');
    expect(lines).toContain('+ new');
  });

  it('renders identical samples as context only', () => {
    const { container } = render(
      <VersionDiff labelA="a" sampleA="same" labelB="b" sampleB="same" />
    );
    const lines = [...container.querySelectorAll('.whitespace-pre')].map(
      (el) => el.textContent
    );
    expect(lines).toEqual(['  same']);
  });

  it('keeps internal blank lines but drops the trailing split artefact', () => {
    const { container } = render(
      <VersionDiff
        labelA="a"
        sampleA={'one\n\ntwo\n'}
        labelB="b"
        sampleB={'one\n\ntwo\n'}
      />
    );
    const lines = [...container.querySelectorAll('.whitespace-pre')].map(
      (el) => el.textContent
    );
    expect(lines).toEqual(['  one', '  ', '  two']);
  });
});
