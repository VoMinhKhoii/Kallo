/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PipelineVersionBadge } from '../pipeline-version-badge';

describe('PipelineVersionBadge', () => {
  it('renders V2 when promptVersionsUsed contains decomposition-grounded', () => {
    render(
      <PipelineVersionBadge
        promptVersionsUsed={{ 'decomposition-grounded': 'pv-1' }}
      />
    );
    expect(screen.getByText('V2')).toBeInTheDocument();
  });

  it('renders V2 when only grounded-estimation key is present', () => {
    render(
      <PipelineVersionBadge
        promptVersionsUsed={{ 'grounded-estimation': 'pv-2' }}
      />
    );
    expect(screen.getByText('V2')).toBeInTheDocument();
  });

  it('renders V1 when only legacy decomposition/nutrition keys are present', () => {
    render(
      <PipelineVersionBadge
        promptVersionsUsed={{ decomposition: 'pv-3', nutrition: 'pv-4' }}
      />
    );
    expect(screen.getByText('V1')).toBeInTheDocument();
  });

  it('renders ? badge when promptVersionsUsed is null', () => {
    render(<PipelineVersionBadge promptVersionsUsed={null} />);
    expect(screen.getByText('PIPELINE: ?')).toBeInTheDocument();
  });

  it('renders ? badge when promptVersionsUsed is an empty object', () => {
    render(<PipelineVersionBadge promptVersionsUsed={{}} />);
    expect(screen.getByText('PIPELINE: ?')).toBeInTheDocument();
  });

  it('renders ? badge when promptVersionsUsed has only unknown keys', () => {
    // Future or partial trace formats must NOT be mislabeled as v1 just
    // because they happen to be non-empty.
    render(
      <PipelineVersionBadge
        promptVersionsUsed={{ 'some-future-stage': 'pv-x' }}
      />
    );
    expect(screen.getByText('PIPELINE: ?')).toBeInTheDocument();
  });
});
