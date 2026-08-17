/**
 * @vitest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { StageWithCalls } from '@/lib/admin/diagnostics/request-trace';
import type { RequestDetailLlmCall } from '@/lib/admin/queries/requests';
import { StageTimeline } from '../stage-timeline';

function stage(
  over: Partial<StageWithCalls['stage']> = {}
): StageWithCalls['stage'] {
  return {
    id: 'sl-1',
    requestId: 'req-1',
    stage: 'decomposition',
    stageIndex: 1,
    inputJson: { raw: 'phở bò' },
    outputJson: { mealItems: [] },
    status: 'success',
    error: null,
    durationMs: 42,
    createdAt: new Date(0),
    ...over,
  } as StageWithCalls['stage'];
}

function call(over: Partial<RequestDetailLlmCall> = {}): RequestDetailLlmCall {
  return {
    id: 'call-1',
    requestId: 'req-1',
    stageLogId: 'sl-1',
    promptVersionId: null,
    model: 'gemini-2.5-flash',
    promptRendered: 'PROMPT',
    responseRaw: '{"ok":true}',
    inputTokens: 100,
    outputTokens: 20,
    latencyMs: 900,
    attempt: 1,
    error: null,
    createdAt: new Date(0),
    metadata: null,
    ...over,
  } as RequestDetailLlmCall;
}

describe('StageTimeline', () => {
  it('renders an empty notice when there are no stages', () => {
    render(<StageTimeline stages={[]} />);
    expect(screen.getByText('No stage logs recorded.')).toBeInTheDocument();
  });

  it('renders the stage header: index, name, status and duration', () => {
    render(<StageTimeline stages={[{ stage: stage(), calls: [] }]} />);
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('decomposition')).toBeInTheDocument();
    expect(screen.getByText('success')).toBeInTheDocument();
    expect(screen.getByText('42 ms')).toBeInTheDocument();
  });

  it('shows the stage error box only when the stage carries an error', () => {
    const { rerender } = render(
      <StageTimeline stages={[{ stage: stage(), calls: [] }]} />
    );
    expect(screen.queryByText('boom')).not.toBeInTheDocument();

    rerender(
      <StageTimeline
        stages={[
          { stage: stage({ status: 'error', error: 'boom' }), calls: [] },
        ]}
      />
    );
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('renders a compare label chip only when one is supplied', () => {
    const { rerender } = render(
      <StageTimeline stages={[{ stage: stage(), calls: [] }]} />
    );
    expect(screen.queryByText('changed')).not.toBeInTheDocument();

    rerender(
      <StageTimeline
        stages={[{ stage: stage(), calls: [], compareLabel: 'changed' }]}
      />
    );
    expect(screen.getByText('changed')).toBeInTheDocument();
  });

  it('opens the Output viewer by default only for successful stages', () => {
    // `defaultOpen` seeds useState, so each case needs its own mount.
    const ok = render(
      <StageTimeline stages={[{ stage: stage(), calls: [] }]} />
    );
    // Collapsed viewers render a truncated preview; open ones render a <pre>.
    expect(ok.container.querySelectorAll('pre')).toHaveLength(1);
    expect(
      ok.container.querySelector('[aria-expanded="true"]')
    ).toHaveTextContent('Output');
    ok.unmount();

    const failed = render(
      <StageTimeline
        stages={[{ stage: stage({ status: 'error' }), calls: [] }]}
      />
    );
    expect(failed.container.querySelectorAll('pre')).toHaveLength(0);
  });

  it('nests LLM calls under their stage with a 1-based label', () => {
    render(
      <StageTimeline
        stages={[
          {
            stage: stage(),
            calls: [call(), call({ id: 'call-2', model: 'gemini-2.5-pro' })],
          },
        ]}
      />
    );
    expect(screen.getByText('LLM Calls (2)')).toBeInTheDocument();
    expect(screen.getByText('Call 1')).toBeInTheDocument();
    expect(screen.getByText('Call 2')).toBeInTheDocument();
    expect(screen.getByText('gemini-2.5-pro')).toBeInTheDocument();
  });

  it('omits the LLM-calls block when a stage has none', () => {
    render(<StageTimeline stages={[{ stage: stage(), calls: [] }]} />);
    expect(screen.queryByText(/LLM Calls/)).not.toBeInTheDocument();
  });

  it('shows the token line only when the call reports tokens', () => {
    const { rerender } = render(
      <StageTimeline stages={[{ stage: stage(), calls: [call()] }]} />
    );
    expect(screen.getByText('100 in / 20 out tokens')).toBeInTheDocument();

    rerender(
      <StageTimeline
        stages={[
          {
            stage: stage(),
            calls: [call({ inputTokens: null, outputTokens: null })],
          },
        ]}
      />
    );
    expect(screen.queryByText(/in \/ .* out tokens/)).not.toBeInTheDocument();
  });

  it('flags a retried attempt', () => {
    render(
      <StageTimeline
        stages={[{ stage: stage(), calls: [call({ attempt: 3 })] }]}
      />
    );
    expect(screen.getByText('attempt 3')).toBeInTheDocument();
  });

  it('renders an error chip and the error body for a failed call', () => {
    render(
      <StageTimeline
        stages={[{ stage: stage(), calls: [call({ error: 'timed out' })] }]}
      />
    );
    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.getByText('timed out')).toBeInTheDocument();
  });

  it('renders no metadata chips when the call has no metadata row', () => {
    render(<StageTimeline stages={[{ stage: stage(), calls: [call()] }]} />);
    expect(screen.queryByText('Provider')).not.toBeInTheDocument();
  });

  it('renders metadata chips, suppressing token counts equal to the call row', () => {
    render(
      <StageTimeline
        stages={[
          {
            stage: stage(),
            calls: [
              call({
                metadata: {
                  provider: 'vertex',
                  region: 'asia-southeast1',
                  cacheStatus: 'hit',
                  // identical to the call row -> suppressed
                  inputTokens: 100,
                  // differs from the call row -> shown
                  outputTokens: 25,
                  cachedTokens: 64,
                  thoughtTokens: null,
                  promptChars: 1234,
                  schemaChars: null,
                } as RequestDetailLlmCall['metadata'],
              }),
            ],
          },
        ]}
      />
    );

    const header = screen.getByText('Call 1').parentElement as HTMLElement;
    expect(within(header).getByText('Provider')).toBeInTheDocument();
    expect(within(header).getByText('vertex')).toBeInTheDocument();
    expect(within(header).getByText('asia-southeast1')).toBeInTheDocument();
    expect(within(header).getByText('hit')).toBeInTheDocument();
    expect(within(header).getByText('25 tokens')).toBeInTheDocument();
    expect(within(header).getByText('64 tokens')).toBeInTheDocument();
    expect(within(header).getByText('1234 chars')).toBeInTheDocument();
    // Suppressed: equal to the call row, and the two nulls.
    expect(within(header).queryByText('100 tokens')).not.toBeInTheDocument();
    expect(within(header).queryByText('Thought')).not.toBeInTheDocument();
    expect(within(header).queryByText('Schema')).not.toBeInTheDocument();
  });
});
