/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CompareLink } from '../compare-link';

/**
 * The two-slot compare selector: `compare` is slot A, `with` is slot B.
 * Every cell in the versions table renders one of these, so the label and
 * href depend on which slots are already filled and whether this row owns one.
 */

const HREF = '/admin/prompts/decomposition';

function renderLink(props: {
  versionId: string;
  currentCompare?: string;
  currentWith?: string;
}) {
  return render(
    <CompareLink
      href={HREF}
      versionId={props.versionId}
      currentCompare={props.currentCompare}
      currentWith={props.currentWith}
    />
  );
}

describe('CompareLink', () => {
  it('offers "Select A" when no slot is filled', () => {
    renderLink({ versionId: 'v1' });
    expect(screen.getByRole('link', { name: 'Select A' })).toHaveAttribute(
      'href',
      `${HREF}?compare=v1`
    );
  });

  it('offers "Clear A" on the row that owns slot A', () => {
    renderLink({ versionId: 'v1', currentCompare: 'v1' });
    expect(screen.getByRole('link', { name: 'Clear A' })).toHaveAttribute(
      'href',
      HREF
    );
  });

  it('offers "Compare with A" on other rows once A is filled', () => {
    renderLink({ versionId: 'v2', currentCompare: 'v1' });
    expect(
      screen.getByRole('link', { name: 'Compare with A' })
    ).toHaveAttribute('href', `${HREF}?compare=v1&with=v2`);
  });

  it('offers "Clear B" on the row that owns slot B', () => {
    renderLink({ versionId: 'v2', currentCompare: 'v1', currentWith: 'v2' });
    expect(screen.getByRole('link', { name: 'Clear B' })).toHaveAttribute(
      'href',
      `${HREF}?compare=v1`
    );
  });

  it('retargets slot B when a third row is clicked with both slots filled', () => {
    renderLink({ versionId: 'v3', currentCompare: 'v1', currentWith: 'v2' });
    expect(
      screen.getByRole('link', { name: 'Compare with A' })
    ).toHaveAttribute('href', `${HREF}?compare=v1&with=v3`);
  });

  it('still clears A from the A row even when B is filled', () => {
    renderLink({ versionId: 'v1', currentCompare: 'v1', currentWith: 'v2' });
    expect(screen.getByRole('link', { name: 'Clear A' })).toHaveAttribute(
      'href',
      HREF
    );
  });

  it('treats a dangling `with` without a `compare` as an empty selection', () => {
    renderLink({ versionId: 'v2', currentWith: 'v9' });
    expect(screen.getByRole('link', { name: 'Select A' })).toHaveAttribute(
      'href',
      `${HREF}?compare=v2`
    );
  });
});
