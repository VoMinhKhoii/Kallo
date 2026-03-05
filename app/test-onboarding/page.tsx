'use client';

import { WizardShell } from '@/components/onboarding/wizard-shell';

export default function TestPage() {
  return (
    <WizardShell
      initialStep={1}
      initialProfile={null}
      onClose={() => window.history.back()}
      onComplete={() => window.location.reload()}
    />
  );
}
