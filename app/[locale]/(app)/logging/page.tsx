import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  type LoggingProfile,
  LoggingShell,
} from '@/components/logging/logging-shell';
import { requireAuthAndProfile } from '@/lib/auth';

const DEFAULT_PROFILE: LoggingProfile = {
  userId: '',
  goal: 'maintaining',
  aggression: 0,
  calorieTarget: 2000,
  proteinTargetG: 150,
  carbsTargetG: 250,
  fatTargetG: 65,
};

const loggingSearchParamsSchema = z.object({
  meal: z.string().trim().min(1).max(300).optional(),
});

export default async function LoggingPage({
  searchParams,
}: {
  searchParams: Promise<{ meal?: string }>;
}) {
  let profile = DEFAULT_PROFILE;
  const rawParams = await searchParams;
  const parsed = loggingSearchParamsSchema.safeParse(rawParams);
  const meal = parsed.success ? parsed.data.meal : undefined;

  try {
    const { user, profile: row } = await requireAuthAndProfile();
    profile = {
      userId: user.id,
      goal: (row.goal as LoggingProfile['goal']) ?? DEFAULT_PROFILE.goal,
      aggression: row.aggression
        ? Number(row.aggression)
        : DEFAULT_PROFILE.aggression,
      calorieTarget: row.calorieTarget ?? DEFAULT_PROFILE.calorieTarget,
      proteinTargetG: row.proteinTargetG ?? DEFAULT_PROFILE.proteinTargetG,
      carbsTargetG: row.carbsTargetG ?? DEFAULT_PROFILE.carbsTargetG,
      fatTargetG: row.fatTargetG ?? DEFAULT_PROFILE.fatTargetG,
    };
  } catch {
    redirect('/');
  }

  return <LoggingShell profile={profile} initialMeal={meal} />;
}
