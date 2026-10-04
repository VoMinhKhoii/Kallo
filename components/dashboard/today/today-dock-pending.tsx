import { DashboardSectionState } from '../dashboard-section-state';
import { TodayDockSkeleton } from './today-dock-skeleton';

/**
 * What the Today slot shows while the day's meals load: the stacked-dial
 * skeleton on phones, so the dock lands without moving the page, and the
 * quiet loading card from `md` up.
 */
export function TodayDockPending({ message }: { message: string }) {
  return (
    <>
      <div className="md:hidden">
        <TodayDockSkeleton />
      </div>
      <div className="hidden md:contents">
        <DashboardSectionState message={message} />
      </div>
    </>
  );
}
