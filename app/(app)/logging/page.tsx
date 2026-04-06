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

export default async function LoggingPage() {
  let profile = DEFAULT_PROFILE;

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
  } catch (error) {
    console.error('Failed to load profile:', error);
  }

  return <LoggingShell profile={profile} />;
}
