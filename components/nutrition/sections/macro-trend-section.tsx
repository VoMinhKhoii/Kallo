'use client';

import { useMemo, useState } from 'react';
import type { NutritionDaySeries } from '@/lib/nutrition/types';
import { BucketDetail } from './bucket-detail';
import { buildBucketDetail } from './bucket-detail-utils';
import { MacroTrendChart } from './macro-trend-chart';
import {
  findTodayIndex,
  localIsoDate,
  type MacroTrendPoint,
} from './macro-trend-utils';

interface MacroTrendSectionProps {
  points: MacroTrendPoint[];
  maxY: number;
  daySeries: NutritionDaySeries;
}

/**
 * The trend chart plus the breakdown panel for whichever column is tapped.
 * Owns the selection so `DaySummary` stays a layout: tapping a column opens
 * that bucket's macros and micronutrients, tapping it again closes them.
 */
export function MacroTrendSection({
  points,
  maxY,
  daySeries,
}: MacroTrendSectionProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [seenSeries, setSeenSeries] = useState(daySeries);

  // A new range or day scope re-buckets the axis, so an index picked against
  // the old one would point at an unrelated column. Adjusted during render
  // rather than in an effect, so the stale selection never paints.
  if (seenSeries !== daySeries) {
    setSeenSeries(daySeries);
    setSelectedIndex(null);
  }

  const today = useMemo(() => localIsoDate(), []);
  const todayIndex = findTodayIndex(points, today);
  const detail =
    selectedIndex === null ? null : buildBucketDetail(daySeries, selectedIndex);

  return (
    <>
      <MacroTrendChart
        points={points}
        maxY={maxY}
        unit={daySeries.unit}
        todayIndex={todayIndex}
        selectedIndex={selectedIndex}
        onSelect={(index) =>
          setSelectedIndex((current) => (current === index ? null : index))
        }
      />
      {detail ? (
        <BucketDetail
          detail={detail}
          isWeekBucket={daySeries.unit === 'week'}
          onClose={() => setSelectedIndex(null)}
        />
      ) : null}
    </>
  );
}
