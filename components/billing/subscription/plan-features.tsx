import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  PLAN_FEATURES,
  type PlanId,
} from '@/components/landing-page/pricing/plans';

/**
 * What the user's plan includes, as a plain checklist under the plan, drawn
 * from the same lists as the pricing page. Paid plans open with "Everything
 * in Free, plus:" and list what they add; Lifetime adds its own extras.
 */
export function PlanFeatures({ plan }: { plan: PlanId }) {
  const t = useTranslations('landing.pricing');
  const features =
    plan === 'lifetime'
      ? [...PLAN_FEATURES.premium, ...PLAN_FEATURES.lifetime]
      : PLAN_FEATURES[plan];

  return (
    <div className="mt-6">
      {plan !== 'free' && (
        <p className="mb-3 text-[13px] text-kallo-text-muted">
          {t('plans.premium.inherits')}
        </p>
      )}
      <ul className="flex flex-col gap-2.5">
        {features.map((id) => (
          <li
            key={id}
            className="flex items-center gap-3 text-[14px] text-kallo-text"
          >
            <Check
              aria-hidden="true"
              className="size-4 shrink-0 text-kallo-text-muted"
            />
            {t(`features.${id}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}
