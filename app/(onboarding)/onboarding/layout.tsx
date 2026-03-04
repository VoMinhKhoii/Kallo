import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-[#FEFBF6]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        {children}
      </div>
    </div>
  );
}
