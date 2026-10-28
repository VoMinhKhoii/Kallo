'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type {
  DashboardProfile,
  HeatmapData,
  HeatmapRange,
} from '@/lib/core/types/dashboard';
import { DashboardSectionState } from './dashboard-section-state';
import { AdherenceHeatmap } from './progress/adherence-heatmap';
import { HeatmapSkeleton } from './progress/progress-section-skeleton';

interface ConsistencyBodyProps {
  /** False until the card has a width to pick its range from. */
  isMeasured: boolean;
  query: UseQueryResult<HeatmapData>;
  range: HeatmapRange;
  profile: DashboardProfile;
  todayDate: string;
}

/** The Consistency card's contents: skeleton, error, or the heatmap. */
export function ConsistencyBody({
  isMeasured,
  query,
  range,
  profile,
  todayDate,
}: ConsistencyBodyProps) {
  const t = useTranslations('dashboard');

  if (!isMeasured || query.isPending) return <HeatmapSkeleton range={range} />;
  if (query.isError) {
    return (
      <DashboardSectionState
        bare
        message={t('heatmapLoadError')}
        actionLabel={t('retry')}
        onAction={() => void query.refetch()}
        variant="error"
      />
    );
  }
  if (!query.data) return <HeatmapSkeleton range={range} />;

  return (
    <AdherenceHeatmap
      data={query.data}
      range={range}
      userId={profile.userId}
      todayDate={todayDate}
    />
  );
}
