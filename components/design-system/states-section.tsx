import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SurfaceState } from '@/components/shared/surface-state/surface-state';
import { Button } from '@/components/ui/button';
import { CIRCLE_CAST } from '@/lib/brand/illustrations/casts/circle';
import { DASHBOARD_CAST } from '@/lib/brand/illustrations/casts/dashboard';
import { NUTRITION_CAST } from '@/lib/brand/illustrations/casts/nutrition';
import { SYSTEM_CAST } from '@/lib/brand/illustrations/casts/system';
import { DsCard, DsSection } from './specimen';

/** The dashboard's first xl grid row, so an in-card state can be measured
 *  against the box it actually has to fit. */
const GRID_CELL =
  'h-[268px] w-full max-w-[320px] overflow-hidden rounded-2xl border border-kallo-border/60 bg-card';

export async function StatesSection() {
  const [common, errors, groups, nutrition, dashboard] = await Promise.all([
    getTranslations('common'),
    getTranslations('errors'),
    getTranslations('groups'),
    getTranslations('nutrition'),
    getTranslations('dashboard'),
  ]);

  return (
    <DsSection
      accent="or nothing loads"
      eyebrow="Surface states"
      id="states"
      intro="Every empty, error, 404 and offline surface takes one shape — hand-drawn illustration, Lora title, one-sentence subtitle, a single ink action — rendered by components/shared/surface-state/ from the area casts in lib/brand/illustrations/casts/. Between 22:00 and 05:00 each animal swaps to its sleeping pose."
      title="When there is nothing,"
    >
      <DsCard title='SurfaceState cast={SYSTEM_CAST} kind="notFound" as="h1" — the 404 page'>
        <SurfaceState
          action={
            <Button asChild size="sm" variant="ink">
              <Link href="/">{common('notFoundHome')}</Link>
            </Button>
          }
          cast={SYSTEM_CAST}
          as="h1"
          kind="notFound"
          subtitle={common('notFoundBody')}
          title={common('notFound')}
        />
      </DsCard>

      <DsCard title='SurfaceState cast={SYSTEM_CAST} kind="error" — the route error boundary'>
        <SurfaceState
          action={
            <Button size="sm" variant="ink">
              {errors('route.retry')}
            </Button>
          }
          cast={SYSTEM_CAST}
          kind="error"
          subtitle={errors('route.body')}
          title={errors('route.title')}
        />
      </DsCard>

      <DsCard title='SurfaceState cast={CIRCLE_CAST} kind="empty" — the friends feed'>
        <SurfaceState
          action={
            <Button size="sm" variant="ink">
              {groups('page.addFriend')}
            </Button>
          }
          cast={CIRCLE_CAST}
          kind="empty"
          subtitle={groups('page.friendsNoMealToday')}
          title={groups('page.friendsEmptyTitle')}
        />
      </DsCard>

      <DsCard title='SurfaceState cast={NUTRITION_CAST} kind="empty" — the overview'>
        <SurfaceState
          action={
            <Button size="sm" variant="ink">
              {nutrition('emptyV2.logMeal')}
            </Button>
          }
          cast={NUTRITION_CAST}
          kind="empty"
          subtitle={nutrition('emptyV2.description')}
          title={nutrition('emptyV2.title')}
        />
      </DsCard>

      <DsCard title='compact cast={DASHBOARD_CAST} kind="error" — inside the 268px dashboard row'>
        <div className="flex flex-wrap items-start gap-4">
          <div className={GRID_CELL}>
            <SurfaceState
              action={
                <Button size="sm" variant="ink">
                  {dashboard('retry')}
                </Button>
              }
              cast={DASHBOARD_CAST}
              className="h-full"
              compact
              kind="error"
              subtitle={dashboard('heatmapLoadError')}
              title={dashboard('sectionErrorTitle')}
            />
          </div>
          <div className="h-[268px] flex-1 overflow-hidden rounded-2xl border border-kallo-border/60 bg-card">
            <SurfaceState
              action={
                <Button size="sm" variant="ink">
                  {dashboard('retry')}
                </Button>
              }
              cast={DASHBOARD_CAST}
              className="h-full"
              compact
              kind="error"
              subtitle={dashboard('heatmapLoadError')}
              title={dashboard('sectionErrorTitle')}
            />
          </div>
        </div>
      </DsCard>

      <DsCard title='compact cast={DASHBOARD_CAST} kind="empty" — the Today meal list'>
        <div className="w-full max-w-[320px] overflow-hidden rounded-2xl border border-kallo-border/60 bg-card">
          <SurfaceState
            cast={DASHBOARD_CAST}
            className="min-h-[96px]"
            compact
            kind="empty"
            subtitle={dashboard('mealReceiptsHint')}
            title={dashboard('noMealsToday')}
          />
        </div>
      </DsCard>

      <DsCard title="Full state in a 320px column — phone width, nothing clipped">
        <div className="w-full max-w-[320px] overflow-hidden rounded-2xl border border-kallo-border/60 bg-kallo-surface">
          <SurfaceState
            action={
              <Button asChild size="sm" variant="ink">
                <Link href="/">{common('notFoundHome')}</Link>
              </Button>
            }
            cast={SYSTEM_CAST}
            kind="notFound"
            subtitle={common('notFoundBody')}
            title={common('notFound')}
          />
        </div>
      </DsCard>
    </DsSection>
  );
}
