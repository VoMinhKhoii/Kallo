import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  TIMEZONE_COOKIE,
  TimezoneCookie,
} from '@/components/app/timezone-cookie';
import {
  type LoggingProfile,
  LoggingShell,
} from '@/components/logging/logging-shell';
import { dayHasEntries } from '@/lib/actions/meals/load-meals';
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
  let email: string | null = null;
  const rawParams = await searchParams;
  const { meal, date } = parseLoggingSearchParams(rawParams);

  try {
    const { user, profile: row } = await requireAuthAndProfile();
    email = user.email ?? null;
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

  // Where the composer belongs — centre of an empty day, or docked under a
  // list of meals — answered HERE so the first frame the browser paints is
  // already right. Left undefined when we cannot answer honestly (no offset
  // cookie on a first-ever visit, or the lookup failed), and the client then
  // does what it always did: dock, then correct once the day loads.
  const initiallyHasEntries = await readInitiallyHasEntries(date);

  return (
    <>
      <TimezoneCookie />
      <LoggingShell
        profile={profile}
        initialMeal={meal}
        initialDate={date}
        email={email}
        initiallyHasEntries={initiallyHasEntries}
      />
    </>
  );
}

/**
 * The server's answer to "does this day hold anything?", or undefined when it
 * has no business guessing.
 *
 * Never throws: this is a hint that saves one reflow, and it must not be able
 * to take the logging page down with it.
 */
async function readInitiallyHasEntries(
  date?: string
): Promise<boolean | undefined> {
  const raw = (await cookies()).get(TIMEZONE_COOKIE)?.value;
  const timezoneOffset = raw === undefined ? Number.NaN : Number(raw);
  if (!Number.isFinite(timezoneOffset)) return undefined;

  try {
    return await dayHasEntries({
      date: date ?? todayInOffset(timezoneOffset),
      timezoneOffset,
    });
  } catch {
    return undefined;
  }
}

/** Today's date in the browser's zone, which is the day the feed opens on. */
function todayInOffset(timezoneOffset: number): string {
  const local = new Date(Date.now() - timezoneOffset * 60_000);
  return local.toISOString().slice(0, 10);
}
