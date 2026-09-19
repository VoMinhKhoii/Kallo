import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeightChartTooltip } from '../weight-chart-tooltip';

/** recharts hands the tooltip every series at that x, in series order. */
const forecastFirst = [
  { dataKey: 'forecast', value: 70.4 },
  { dataKey: 'actual', value: 70.4 },
];

describe('WeightChartTooltip', () => {
  it('reads the logged series by name, not by payload position', () => {
    render(<WeightChartTooltip active payload={forecastFirst} />);
    expect(screen.getByText(/70\.4/)).toBeInTheDocument();
  });

  it('does not render on the forecast-only trailing point', () => {
    // This is the crash: the projection extends past the last reading, so
    // `actual` is null there. Reading payload[0].value.toFixed(1) threw.
    const { container } = render(
      <WeightChartTooltip
        active
        payload={[
          { dataKey: 'forecast', value: 69.8 },
          { dataKey: 'actual', value: null },
        ]}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render when the payload carries no logged series at all', () => {
    const { container } = render(
      <WeightChartTooltip
        active
        payload={[{ dataKey: 'forecast', value: 69.8 }]}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('stays closed when inactive or empty', () => {
    const { container: inactive } = render(
      <WeightChartTooltip payload={forecastFirst} />
    );
    expect(inactive).toBeEmptyDOMElement();

    const { container: empty } = render(
      <WeightChartTooltip active payload={[]} />
    );
    expect(empty).toBeEmptyDOMElement();
  });

  it('takes its unit from the message catalogue rather than a hardcoded kg', () => {
    render(<WeightChartTooltip active payload={forecastFirst} />);
    // The global next-intl mock echoes keys, so the key itself is the proof.
    expect(screen.getByText(/units\.kg/)).toBeInTheDocument();
  });

  it('names the day the reading belongs to', () => {
    render(
      <WeightChartTooltip
        active
        label={22}
        payload={forecastFirst}
        formatDay={(day) => `day ${day}`}
      />
    );
    expect(screen.getByText('day 22')).toBeInTheDocument();
  });

  it('omits the date line when there is no formatter', () => {
    render(<WeightChartTooltip active label={22} payload={forecastFirst} />);
    expect(screen.queryByText(/day/)).not.toBeInTheDocument();
  });
});
