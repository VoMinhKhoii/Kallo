import type { ReactElement } from 'react';

interface ReadingDotProps {
  cx?: number;
  cy?: number;
  index?: number;
  key?: string;
}

/**
 * How a logged reading is marked: a filled dot ringed in the card it sits on,
 * and a soft halo on the newest one so "today" reads without a second axis
 * marker. The ring tracks the surface rather than being a fixed white, which is
 * what let dots halo against the dark card.
 *
 * Mirrors the mobile `TodayDotPainter`.
 */
export function makeReadingDot(
  lastIndex: number,
  color: string,
  ring: string
): (props: ReadingDotProps) => ReactElement<SVGElement> {
  return ({ cx, cy, index, key }) => {
    if (cx == null || cy == null) return <g key={key} />;

    if (index === lastIndex) {
      return (
        <g key={key}>
          <circle cx={cx} cy={cy} r={9} fill={color} opacity={0.16} />
          <circle
            cx={cx}
            cy={cy}
            r={5}
            fill={color}
            stroke={ring}
            strokeWidth={2}
          />
        </g>
      );
    }

    return (
      <circle
        key={key}
        cx={cx}
        cy={cy}
        r={4}
        fill={color}
        stroke={ring}
        strokeWidth={2}
      />
    );
  };
}
