import { redirect } from 'next/navigation';
import {
  type LoggingProfile,
  LoggingShell,
} from '@/components/logging/logging-shell';
import { requireAuthAndProfile } from '@/lib/auth';
import { parseLoggingSearchParams } from './search-params';

const DEFAULT_PROFILE: LoggingProfile = {
  userId: '',
  goal: 'maintaining',
  aggression: 0,
  calorieTarget: 2000,
  proteinTargetG: 150,
  carbsTargetG: 250,
  fatTargetG: 65,
};

export default async function LoggingPage({
  searchParams,
}: {
  searchParams: Promise<{ meal?: string; date?: string }>;
}) {
  let profile = DEFAULT_PROFILE;
  const rawParams = await searchParams;
  const { meal, date } = parseLoggingSearchParams(rawParams);

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

  return (
    <LoggingShell profile={profile} initialMeal={meal} initialDate={date} />
  );
}
